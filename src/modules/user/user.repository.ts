import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/response/paginated-response';

@Injectable()
export class UserRepository extends BaseRepository<
  User,
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.user);
  }

  private get activeWhere(): Prisma.UserWhereInput {
    return { deletedAt: null };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async searchUsers(pagination: PaginationDto): Promise<PaginatedResponse<User>> {
    const { page = 1, limit = 10, skip, search, sortBy = 'createdAt', order = 'DESC' } =
      pagination;

    const where: Prisma.UserWhereInput = {
      ...this.activeWhere,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order.toLowerCase() },
      }),
      this.prisma.user.count({ where }),
    ]);

    return new PaginatedResponse<User>(data, total, page, limit);
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }
}
