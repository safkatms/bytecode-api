import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponse } from '../response/paginated-response';

/**
 * Represents any Prisma model delegate (e.g. prisma.user).
 * T  = the model type (e.g. User from @prisma/client)
 * W  = the model's WhereInput
 * OB = the model's OrderByInput
 */
export interface PrismaDelegate<T, W = any, OB = any> {
  findMany(args?: {
    where?: W;
    orderBy?: OB | OB[];
    skip?: number;
    take?: number;
    select?: any;
    include?: any;
  }): Promise<T[]>;

  findFirst(args?: { where?: W; select?: any; include?: any }): Promise<T | null>;

  findUnique(args: { where: any; select?: any; include?: any }): Promise<T | null>;

  create(args: { data: any; select?: any; include?: any }): Promise<T>;

  update(args: { where: any; data: any; select?: any; include?: any }): Promise<T>;

  delete(args: { where: any }): Promise<T>;

  count(args?: { where?: W }): Promise<number>;
}

export abstract class BaseRepository<T, W = any, OB = any> {
  constructor(protected readonly delegate: PrismaDelegate<T, W, OB>) {}

  async findAll(args?: {
    where?: W;
    orderBy?: OB | OB[];
    select?: any;
    include?: any;
  }): Promise<T[]> {
    return this.delegate.findMany(args);
  }

  async findPaginated(
    pagination: PaginationDto,
    args?: { where?: W; orderBy?: OB | OB[]; include?: any },
    message?: string,
  ): Promise<PaginatedResponse<T>> {
    const { page = 1, limit = 10, skip } = pagination;

    const [data, total] = await Promise.all([
      this.delegate.findMany({ ...args, skip, take: limit }),
      this.delegate.count({ where: args?.where }),
    ]);

    return new PaginatedResponse<T>(data, total, page, limit, message);
  }

  async findById(id: number, include?: any): Promise<T | null> {
    return this.delegate.findUnique({ where: { id }, include });
  }

  async findOne(args: { where: W; include?: any }): Promise<T | null> {
    return this.delegate.findFirst(args);
  }

  async create(data: any, include?: any): Promise<T> {
    return this.delegate.create({ data, include });
  }

  async update(id: number, data: any, include?: any): Promise<T> {
    return this.delegate.update({ where: { id }, data, include });
  }

  /**
   * Soft delete — sets deletedAt timestamp instead of destroying the row.
   * Your Prisma queries should filter `where: { deletedAt: null }` by default.
   */
  async softDelete(id: number): Promise<T> {
    return this.delegate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async hardDelete(id: number): Promise<T> {
    return this.delegate.delete({ where: { id } });
  }

  async exists(where: W): Promise<boolean> {
    const count = await this.delegate.count({ where });
    return count > 0;
  }

  async count(where?: W): Promise<number> {
    return this.delegate.count({ where });
  }
}
