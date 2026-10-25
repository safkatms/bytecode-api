import { Injectable } from '@nestjs/common';
import { CasualLeaveRequest, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { CasualLeaveFilterDto } from './dto/casual-leave.dto';

@Injectable()
export class CasualLeaveRepository extends BaseRepository<
    CasualLeaveRequest,
    Prisma.CasualLeaveRequestWhereInput,
    Prisma.CasualLeaveRequestOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.casualLeaveRequest);
    }

    private get active(): Prisma.CasualLeaveRequestWhereInput {
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
        return this.prisma.casualLeaveRequest.findFirst({
            where: { id, ...this.active },
            include: this.includeEmployee,
        });
    }

    async findOverlapping(employeeId: number, startDate: Date, endDate: Date, excludeId?: number) {
        return this.prisma.casualLeaveRequest.findFirst({
            where: {
                ...this.active,
                employeeId,
                status: { in: ['pending', 'approved'] },
                ...(excludeId && { id: { not: excludeId } }),
                OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
            },
        });
    }

    async search(filter: CasualLeaveFilterDto): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, skip, sortBy = 'createdAt', order = 'DESC' } = filter;

        const where: Prisma.CasualLeaveRequestWhereInput = {
            ...this.active,
            ...(filter.status && { status: filter.status as any }),
            ...(filter.employeeId && { employeeId: filter.employeeId }),
            ...(filter.year && {
                startDate: { gte: new Date(`${filter.year}-01-01`) },
                endDate: { lte: new Date(`${filter.year}-12-31`) },
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.casualLeaveRequest.findMany({
                where, skip, take: limit,
                orderBy: { [sortBy]: order.toLowerCase() },
                include: this.includeEmployee,
            }),
            this.prisma.casualLeaveRequest.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    // ─── Balance ──────────────────────────────────────────────────

    async findBalance(employeeId: number, year: number) {
        return this.prisma.casualLeaveBalance.findUnique({
            where: { employeeId_year: { employeeId, year } },
        });
    }

    async upsertBalance(employeeId: number, year: number, allocatedDays: number, carryForwardDays = 0) {
        return this.prisma.casualLeaveBalance.upsert({
            where: { employeeId_year: { employeeId, year } },
            create: { employeeId, year, allocatedDays, carryForwardDays, usedDays: 0 },
            update: {},
        });
    }

    async incrementUsedDays(employeeId: number, year: number, days: number) {
        return this.prisma.casualLeaveBalance.update({
            where: { employeeId_year: { employeeId, year } },
            data: { usedDays: { increment: days } },
        });
    }

    async decrementUsedDays(employeeId: number, year: number, days: number) {
        return this.prisma.casualLeaveBalance.update({
            where: { employeeId_year: { employeeId, year } },
            data: { usedDays: { decrement: days } },
        });
    }

    // ─── Policy ───────────────────────────────────────────────────

    async getPolicy(year: number) {
        return this.prisma.casualLeavePolicy.findUnique({ where: { year } });
    }

    async upsertPolicy(year: number, totalDays: number, maxCarryForward: number, adminId: number) {
        return this.prisma.casualLeavePolicy.upsert({
            where: { year },
            create: { year, totalDays, maxCarryForward, createdBy: adminId, updatedBy: adminId },
            update: { totalDays, maxCarryForward, updatedBy: adminId },
        });
    }

    async getActivePolicyYear(year: number) {
        return this.prisma.casualLeavePolicy.findFirst({
            where: { year, isActive: true },
        });
    }
}
