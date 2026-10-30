import { Injectable } from '@nestjs/common';
import { Holiday, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { HolidayFilterDto } from './dto/holiday.dto';

@Injectable()
export class HolidayRepository extends BaseRepository<
    Holiday,
    Prisma.HolidayWhereInput,
    Prisma.HolidayOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.holiday);
    }

    private get active(): Prisma.HolidayWhereInput {
        return { deletedAt: null, recordStatus: 'active' };
    }

    private get includeExclusions() {
        return {
            exclusions: {
                include: {
                    employee: {
                        select: {
                            id: true, employeeCode: true,
                            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                        },
                    },
                    team: { select: { id: true, name: true } },
                },
            },
        } as const;
    }

    async findById(id: number) {
        return this.prisma.holiday.findFirst({
            where: { id, ...this.active },
            include: this.includeExclusions,
        });
    }

    async findOverlapping(startDate: Date, endDate: Date, excludeId?: number) {
        return this.prisma.holiday.findFirst({
            where: {
                ...this.active,
                ...(excludeId && { id: { not: excludeId } }),
                startDate: { lte: endDate },
                endDate:   { gte: startDate },
            },
        });
    }

    async search(filter: HolidayFilterDto): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 20, skip, sortBy = 'startDate', order = 'ASC' } = filter;

        const where: Prisma.HolidayWhereInput = {
            ...this.active,
            ...(filter.year && {
                startDate: { gte: new Date(`${filter.year}-01-01`) },
                endDate:   { lte: new Date(`${filter.year}-12-31`) },
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.holiday.findMany({
                where, skip, take: limit,
                orderBy: { [sortBy]: order.toLowerCase() },
                include: this.includeExclusions,
            }),
            this.prisma.holiday.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    async replaceExclusions(holidayId: number, employeeIds: number[], teamIds: number[]) {
        await this.prisma.holidayExclusion.deleteMany({ where: { holidayId } });

        const data = [
            ...employeeIds.map((employeeId) => ({ holidayId, employeeId })),
            ...teamIds.map((teamId) => ({ holidayId, teamId })),
        ];

        if (data.length > 0) {
            await this.prisma.holidayExclusion.createMany({ data });
        }
    }
}
