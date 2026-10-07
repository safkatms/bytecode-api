import { Injectable } from '@nestjs/common';
import { Employee, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { EmployeeFilterDto } from './dto/employee.dto';

@Injectable()
export class EmployeeRepository extends BaseRepository<
    Employee,
    Prisma.EmployeeWhereInput,
    Prisma.EmployeeOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.employee);
    }

    private get active(): Prisma.EmployeeWhereInput {
        return { deletedAt: null, recordStatus: 'active' };
    }

    async findById(id: number) {
        return this.prisma.employee.findFirst({
            where: { id, ...this.active },
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
        });
    }

    async findByUserId(userId: number) {
        return this.prisma.employee.findFirst({
            where: { userId, ...this.active },
        });
    }

    async findByCode(employeeCode: string) {
        return this.prisma.employee.findFirst({ where: { employeeCode, ...this.active } });
    }

    async search(filter: EmployeeFilterDto): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, skip, search, sortBy = 'createdAt', order = 'DESC' } = filter;

        const where: Prisma.EmployeeWhereInput = {
            ...this.active,
            ...(search && {
                OR: [
                    { employeeCode: { contains: search, mode: 'insensitive' } },
                    { user: { firstName: { contains: search, mode: 'insensitive' } } },
                    { user: { lastName: { contains: search, mode: 'insensitive' } } },
                    { user: { email: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.employee.findMany({
                where, skip, take: limit,
                orderBy: { [sortBy]: order.toLowerCase() },
                include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
            }),
            this.prisma.employee.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    async getActiveIds(): Promise<number[]> {
        const rows = await this.prisma.employee.findMany({
            where: { ...this.active, isActive: true },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    }
}
