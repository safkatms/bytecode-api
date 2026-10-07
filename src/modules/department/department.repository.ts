import { Injectable } from '@nestjs/common';
import { Department, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { DepartmentFilterDto } from './dto/department.dto';

@Injectable()
export class DepartmentRepository extends BaseRepository<
    Department,
    Prisma.DepartmentWhereInput,
    Prisma.DepartmentOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.department);
    }

    private get active(): Prisma.DepartmentWhereInput {
        return { deletedAt: null, recordStatus: 'active' };
    }

    async findById(id: number) {
        return this.prisma.department.findFirst({
            where: { id, ...this.active },
        });
    }

    async findByName(name: string) {
        return this.prisma.department.findFirst({
            where: { name, ...this.active },
        });
    }

    async search(filter: DepartmentFilterDto): Promise<PaginatedResponse<Department>> {
        const { page = 1, limit = 10, skip, search, sortBy = 'createdAt', order = 'DESC' } = filter;

        const where: Prisma.DepartmentWhereInput = {
            ...this.active,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.department.findMany({
                where, skip, take: limit,
                orderBy: { [sortBy]: order.toLowerCase() },
            }),
            this.prisma.department.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    async findAllActive() {
        return this.prisma.department.findMany({
            where: { ...this.active, isActive: true },
            orderBy: { name: 'asc' },
        });
    }
}
