import { Injectable } from '@nestjs/common';
import { Prisma, SickLeaveRequest } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { SickLeaveFilterDto } from './dto/sick-leave.dto';

@Injectable()
export class SickLeaveRepository extends BaseRepository<
    SickLeaveRequest,
    Prisma.SickLeaveRequestWhereInput,
    Prisma.SickLeaveRequestOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.sickLeaveRequest);
    }

    private get active(): Prisma.SickLeaveRequestWhereInput {
        return { deletedAt: null, recordStatus: 'active' };
    }

    private get includeEmployee() {
        return {
            employee: {
                select: {
                    id: true, employeeCode: true, designation: true,
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            },
        } as const;
    }

    async findById(id: number) {
        return this.prisma.sickLeaveRequest.findFirst({
            where: { id, ...this.active },
            include: this.includeEmployee,
        });
    }

    async findOverlapping(employeeId: number, startDate: Date, endDate: Date, excludeId?: number) {
        return this.prisma.sickLeaveRequest.findFirst({
            where: {
                ...this.active,
                employeeId,
                status: { in: ['pending', 'approved'] },
                ...(excludeId && { id: { not: excludeId } }),
                OR: [
                    { startDate: { lte: endDate }, endDate: { gte: startDate } },
                ],
            },
        });
    }

    async search(filter: SickLeaveFilterDto): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, skip, sortBy = 'createdAt', order = 'DESC' } = filter;

        const where: Prisma.SickLeaveRequestWhereInput = {
            ...this.active,
            ...(filter.status && { status: filter.status as any }),
            ...(filter.employeeId && { employeeId: filter.employeeId }),
            ...(filter.year && {
                startDate: { gte: new Date(`${filter.year}-01-01`) },
                endDate: { lte: new Date(`${filter.year}-12-31`) },
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.sickLeaveRequest.findMany({
                where, skip, take: limit,
                orderBy: { [sortBy]: order.toLowerCase() },
                include: this.includeEmployee,
            }),
            this.prisma.sickLeaveRequest.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    async findBalance(employeeId: number, year: number) {
        return this.prisma.sickLeaveBalance.findUnique({
            where: { employeeId_year: { employeeId, year } },
        });
    }

    async upsertBalance(employeeId: number, year: number, totalDays: number) {
        return this.prisma.sickLeaveBalance.upsert({
            where: { employeeId_year: { employeeId, year } },
            create: { employeeId, year, totalDays, usedDays: 0 },
            update: {},
        });
    }

    async setUsedDays(employeeId: number, year: number, usedDays: number) {
        return this.prisma.sickLeaveBalance.update({
            where: { employeeId_year: { employeeId, year } },
            data: { usedDays },
        });
    }

    async incrementUsedDays(employeeId: number, year: number, days: number) {
        return this.prisma.sickLeaveBalance.update({
            where: { employeeId_year: { employeeId, year } },
            data: { usedDays: { increment: days } },
        });
    }

    async decrementUsedDays(employeeId: number, year: number, days: number) {
        return this.prisma.sickLeaveBalance.update({
            where: { employeeId_year: { employeeId, year } },
            data: { usedDays: { decrement: days } },
        });
    }

    async getPolicy(year: number) {
        return this.prisma.sickLeavePolicy.findUnique({ where: { year } });
    }

    async upsertPolicy(year: number, totalDays: number, adminId: number) {
        return this.prisma.sickLeavePolicy.upsert({
            where: { year },
            create: { year, totalDays, createdBy: adminId, updatedBy: adminId },
            update: { totalDays, updatedBy: adminId },
        });
    }

    async getActivePolicyYear(year: number) {
        return this.prisma.sickLeavePolicy.findFirst({
            where: { year, isActive: true },
        });
    }
}
