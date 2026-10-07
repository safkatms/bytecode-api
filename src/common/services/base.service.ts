import { BaseRepository } from '../repositories/base.repository';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponse } from '../response/paginated-response';
import { NotFoundException } from '../exceptions/app.exception';

export abstract class BaseService<T, W = any, OB = any> {
  constructor(
    protected readonly repository: BaseRepository<T, W, OB>,
    protected readonly entityName: string = 'Resource',
  ) {}

  async findAll(args?: { where?: W; orderBy?: OB | OB[] }): Promise<T[]> {
    return this.repository.findAll(args);
  }

  async findPaginated(
    pagination: PaginationDto,
    args?: { where?: W; orderBy?: OB | OB[]; include?: any },
  ): Promise<PaginatedResponse<T>> {
    return this.repository.findPaginated(pagination, args);
  }

  async findById(id: number, include?: any): Promise<T> {
    const entity = await this.repository.findById(id, include);
    if (!entity) throw new NotFoundException(this.entityName);
    return entity;
  }

  async create(data: any, include?: any): Promise<T> {
    return this.repository.create(data, include);
  }

  async update(id: number, data: any, include?: any): Promise<T> {
    await this.findById(id); // throws if not found
    return this.repository.update(id, data, include);
  }

  async remove(id: number): Promise<T> {
    await this.findById(id);
    return this.repository.softDelete(id);
  }
}
