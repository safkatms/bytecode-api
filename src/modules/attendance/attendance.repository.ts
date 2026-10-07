import { Injectable } from '@nestjs/common';
import { Attendance, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { AttendanceFilterDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceRepository extends BaseRepository<
    Attendance,
    Prisma.AttendanceWhereInput,
    Prisma.AttendanceOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.attendance);
    }

    private get active(): Prisma.AttendanceWhereInput {
        return { deletedAt: null, recordStatus: 'active' };
    }

    async findByEmployeeAndDate(employeeId: number, date: Date) {
        return this.prisma.attendance.findFirst({
            where: { employeeId, attendanceDate: date, ...this.active },
        });
    }

    async findById(id: number) {
        return this.prisma.attendance.findFirst({
            where: { id, ...this.active },
            include: {
                employee: {
                    select: {
                        id: true, employeeCode: true, designation: true,
                        user: { select: { firstName: true, lastName: true, email: true } }
                    },
                },
            },
        });
    }

    async findMany(filter: AttendanceFilterDto): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, skip, sortBy = 'attendanceDate', order = 'DESC' } = filter;

        const where: Prisma.AttendanceWhereInput = {
            ...this.active,
            ...(filter.employeeId && { employeeId: filter.employeeId }),
            ...(filter.status && { status: filter.status }),
            ...((filter.fromDate || filter.toDate) && {
                attendanceDate: {
                    ...(filter.fromDate && { gte: new Date(filter.fromDate) }),
                    ...(filter.toDate && { lte: new Date(filter.toDate) }),
                },
            }),
        };

        const include = {
            employee: {
                select: {
                    id: true, employeeCode: true,
                    user: { select: { firstName: true, lastName: true } }
                },
            },
        };

        const [data, total] = await Promise.all([
            this.prisma.attendance.findMany({ where, skip, take: limit, orderBy: { [sortBy]: order.toLowerCase() }, include }),
            this.prisma.attendance.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    async getMonthlySummary(employeeId: number, year: number, month: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const records = await this.prisma.attendance.findMany({
            where: { employeeId, ...this.active, attendanceDate: { gte: startDate, lte: endDate } },
            orderBy: { attendanceDate: 'asc' },
        });

        const summary = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, holiday: 0, weekend: 0, totalWorkHours: 0, totalLateMinutes: 0 };
        for (const r of records) {
            summary[r.status] = (summary[r.status] ?? 0) + 1;
            summary.totalWorkHours += Number(r.workHours ?? 0);
            summary.totalLateMinutes += r.lateMinutes ?? 0;
        }

        return { month: `${year}-${String(month).padStart(2, '0')}`, summary, records };
    }

    async getDailySummary(date: Date) {
        return this.prisma.attendance.groupBy({
            by: ['status'],
            where: { attendanceDate: date, ...this.active },
            _count: { id: true },
        });
    }
}
