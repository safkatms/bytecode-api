# NestJS Layered Architecture Template
**PostgreSQL + Prisma + JWT + Swagger**

---

## Stack
| Layer | Tool |
|---|---|
| Framework | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Auth | Passport JWT (access + refresh) |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI |

---

## Project Structure

```
prisma/
├── schema.prisma          ← Single source of truth for all models
└── seed.ts                ← Seed admin user

src/
├── config/                ← appConfig, jwtConfig (DATABASE_URL read by Prisma directly)
├── database/
│   ├── prisma.service.ts  ← Injectable PrismaClient with lifecycle hooks
│   └── prisma.module.ts   ← @Global() — PrismaService available everywhere
│
├── common/
│   ├── decorators/        ← @Public(), @Roles(), @CurrentUser()
│   ├── dto/               ← PaginationDto
│   ├── exceptions/        ← AppException, NotFoundException, ConflictException …
│   ├── filters/           ← GlobalExceptionFilter (handles HttpException + Prisma errors)
│   ├── guards/            ← JwtAuthGuard, RolesGuard
│   ├── interceptors/      ← TransformInterceptor, LoggingInterceptor
│   ├── repositories/      ← BaseRepository<T, W, OB> — generic Prisma CRUD
│   ├── response/          ← ApiResponse<T>, PaginatedResponse<T>
│   └── services/          ← BaseService<T, W, OB>
│
└── modules/
    ├── auth/              ← register, login, refresh
    └── user/              ← Full CRUD reference implementation
```

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Set DATABASE_URL and JWT secrets in .env

# 3. Run migrations
npm run db:migrate        # creates tables from schema.prisma

# 4. Seed the database
npm run db:seed           # creates admin@example.com / admin123

# 5. Start dev server
npm run start:dev
```

Swagger UI → `http://localhost:3000/api/v1/docs`

---

## Prisma Workflow

```bash
# After editing prisma/schema.prisma:
npm run db:migrate        # create + apply a new migration (dev)
npm run db:generate       # regenerate Prisma Client types

# Production:
npm run db:migrate:deploy  # apply pending migrations without prompts

# Explore data:
npm run db:studio
```

---

## Response Shapes

### Success
```json
{ "success": true, "statusCode": 200, "message": "Success",
  "data": {}, "timestamp": "..." }
```
### Paginated
```json
{ "success": true, "statusCode": 200, "data": [],
  "meta": { "totalItems": 100, "totalPages": 10, "currentPage": 1,
            "itemsPerPage": 10, "itemCount": 10 }, "timestamp": "..." }
```
### Error
```json
{ "success": false, "statusCode": 404, "message": "User not found",
  "errors": null, "timestamp": "...", "path": "/api/v1/users/99" }
```

Prisma errors (P2002 unique, P2025 not found, P2003 FK) are caught automatically
in `GlobalExceptionFilter` and converted to the same shape.

---

## Adding a New Module

### 1. Add model to `prisma/schema.prisma`
```prisma
model Post {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(255)
  body      String
  authorId  Int       @map("author_id")
  author    User      @relation(fields: [authorId], references: [id])
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt      @map("updated_at")
  deletedAt DateTime?                 @map("deleted_at")
  @@map("posts")
}
```

### 2. Run migration
```bash
npm run db:migrate
```

### 3. Create the module files

```
src/modules/post/
├── dto/post.dto.ts           ← CreatePostDto, UpdatePostDto (PartialType)
├── post.repository.ts        ← extends BaseRepository<Post, Prisma.PostWhereInput, ...>
├── post.service.ts           ← extends BaseService<Post, ...>
├── post.controller.ts        ← return ApiResponse.ok(...) / PaginatedResponse
└── post.module.ts            ← no TypeORM imports needed
```

**Repository skeleton:**
```ts
@Injectable()
export class PostRepository extends BaseRepository<
  Post,
  Prisma.PostWhereInput,
  Prisma.PostOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.post);  // ← pass the delegate
  }
  // add custom queries here
}
```

### 4. Register in AppModule
```ts
imports: [..., PostModule]
```

---

## Auth Decorators

```ts
@Get('open')
@Public()                       // no JWT required
async openRoute() {}

@Delete(':id')
@Roles(Role.admin)              // JWT + role check
async adminOnly() {}

@Get('me')
async getMe(@CurrentUser() user: User) {}  // full user from JWT
```

---

## Soft Delete Pattern

Every model has `deletedAt DateTime?`. Repository queries filter `deletedAt: null` by default.
`BaseRepository.softDelete(id)` sets `deletedAt = new Date()` — never destroys the row.
