import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceStatus } from '@prisma/client';

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Admin Dashboard ──────────────────────────────────────────

    async getAdminOverview() {
        const today = this.todayDate();

        const [
            totalEmployees,
            activeEmployees,
            todayAttendance,
            pendingDevices,
        ] = await Promise.all([
            this.prisma.employee.count({ where: { deletedAt: null, recordStatus: 'active' } }),
            this.prisma.employee.count({ where: { deletedAt: null, recordStatus: 'active', isActive: true } }),
            this.prisma.attendance.groupBy({
                by: ['status'],
                where: { attendanceDate: today, deletedAt: null, recordStatus: 'active' },
                _count: { id: true },
            }),
            // Devices registered but not yet seen after initial auto-register (optional signal)
            this.prisma.trustedDevice.count({ where: { isActive: true } }),
        ]);

        const statusMap = this.groupByToMap(todayAttendance);

        return {
            employees: { total: totalEmployees, active: activeEmployees, inactive: totalEmployees - activeEmployees },
            todayAttendance: {
                present: statusMap[AttendanceStatus.present] ?? 0,
                late: statusMap[AttendanceStatus.late] ?? 0,
                absent: statusMap[AttendanceStatus.absent] ?? 0,
                onLeave: statusMap[AttendanceStatus.on_leave] ?? 0,
                halfDay: statusMap[AttendanceStatus.half_day] ?? 0,
                notMarked: activeEmployees - Object.values(statusMap).reduce((s, n) => s + n, 0),
            },
            devices: { trusted: pendingDevices },
        };
    }

    async getAdminAttendanceTrend(months = 6) {
        const results: Array<{ month: string; present: number; late: number; absent: number }> = [];

        for (let i = months - 1; i >= 0; i--) {
            const ref = this.subMonthsBd(this.nowBd(), i);
            const start = this.startOfMonthBd(ref);
            const end = this.endOfMonthBd(ref);
            const label = this.formatMonth(ref);

            const rows = await this.prisma.attendance.groupBy({
                by: ['status'],
                where: {
                    attendanceDate: { gte: start, lte: end },
                    deletedAt: null, recordStatus: 'active',
                },
                _count: { id: true },
            });

            const m = this.groupByToMap(rows);
            results.push({
                month: label,
                present: (m[AttendanceStatus.present] ?? 0) + (m[AttendanceStatus.late] ?? 0),
                late: m[AttendanceStatus.late] ?? 0,
                absent: m[AttendanceStatus.absent] ?? 0,
            });
        }

        return results;
    }

    async getAdminDepartmentBreakdown() {
        const today = this.todayDate();

        const employees = await this.prisma.employee.findMany({
            where: { deletedAt: null, recordStatus: 'active', isActive: true },
            select: { id: true, department: { select: { name: true } } },
        });

        const attendanceToday = await this.prisma.attendance.findMany({
            where: { attendanceDate: today, deletedAt: null, recordStatus: 'active' },
            select: { employeeId: true, status: true },
        });

        const attendanceMap = new Map(attendanceToday.map((a) => [a.employeeId, a.status]));

        const deptMap: Record<string, { total: number; present: number; absent: number; late: number }> = {};

        for (const emp of employees) {
            const dept = emp.department?.name ?? 'Unassigned';
            if (!deptMap[dept]) deptMap[dept] = { total: 0, present: 0, absent: 0, late: 0 };

            deptMap[dept].total++;
            const status = attendanceMap.get(emp.id);
            if (status === AttendanceStatus.present) deptMap[dept].present++;
            else if (status === AttendanceStatus.late) { deptMap[dept].present++; deptMap[dept].late++; }
            else deptMap[dept].absent++;
        }

        return Object.entries(deptMap).map(([department, stats]) => ({ department, ...stats }));
    }

    async getAdminRecentActivity(limit = 10) {
        const records = await this.prisma.attendance.findMany({
            where: { deletedAt: null, recordStatus: 'active' },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            include: {
                employee: {
                    select: {
                        employeeCode: true, department: true,
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        });

        return records.map((r) => ({
            id: r.id,
            employee: `${r.employee.user.firstName} ${r.employee.user.lastName}`,
            employeeCode: r.employee.employeeCode,
            department: r.employee.department,
            date: r.attendanceDate,
            status: r.status,
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime,
            isManual: r.isManual,
        }));
    }

    async getAdminLateReport(month?: string) {
        const ref = month ? new Date(`${month}-01`) : this.nowBd();
        const start = this.startOfMonthBd(ref);
        const end = this.endOfMonthBd(ref);

        const rows = await this.prisma.attendance.findMany({
            where: {
                status: AttendanceStatus.late,
                attendanceDate: { gte: start, lte: end },
                deletedAt: null, recordStatus: 'active',
            },
            include: {
                employee: {
                    select: {
                        id: true, employeeCode: true, department: true,
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
            },
            orderBy: { lateMinutes: 'desc' },
        });

        // Group by employee
        const empMap: Record<number, { employee: any; count: number; totalLateMinutes: number }> = {};
        for (const r of rows) {
            const id = r.employee.id;
            if (!empMap[id]) empMap[id] = { employee: r.employee, count: 0, totalLateMinutes: 0 };
            empMap[id].count++;
            empMap[id].totalLateMinutes += r.lateMinutes ?? 0;
        }

        return Object.values(empMap).sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);
    }

    // ─── Employee Dashboard ───────────────────────────────────────

    async getEmployeeOverview(employeeId: number) {
        const today = this.todayDate();
        const now = this.nowBd();
        const start = this.startOfMonthBd(now);
        const end = this.endOfMonthBd(now);

        const [todayRecord, monthlyStats, devices] = await Promise.all([
            this.prisma.attendance.findFirst({
                where: { employeeId, attendanceDate: today, deletedAt: null, recordStatus: 'active' },
            }),
            this.prisma.attendance.groupBy({
                by: ['status'],
                where: {
                    employeeId,
                    attendanceDate: { gte: start, lte: end },
                    deletedAt: null, recordStatus: 'active',
                },
                _count: { id: true },
                _sum: { lateMinutes: true },
            }),
            this.prisma.trustedDevice.findMany({
                where: { employeeId, isActive: true },
                select: { id: true, deviceName: true, deviceId: true, lastSeenAt: true },
            }),
        ]);

        const statusMap = this.groupByToMap(monthlyStats);
        const lateMinutes = monthlyStats.find((r) => r.status === AttendanceStatus.late)?._sum?.lateMinutes ?? 0;

        return {
            today: {
                checkedIn: !!todayRecord?.checkInTime,
                checkedOut: !!todayRecord?.checkOutTime,
                checkInTime: todayRecord?.checkInTime ?? null,
                checkOutTime: todayRecord?.checkOutTime ?? null,
                status: todayRecord?.status ?? null,
                workHours: todayRecord?.workHours ?? null,
            },
            thisMonth: {
                present: (statusMap[AttendanceStatus.present] ?? 0) + (statusMap[AttendanceStatus.late] ?? 0),
                late: statusMap[AttendanceStatus.late] ?? 0,
                absent: statusMap[AttendanceStatus.absent] ?? 0,
                onLeave: statusMap[AttendanceStatus.on_leave] ?? 0,
                totalLateMinutes: lateMinutes,
            },
            devices,
        };
    }

    async getEmployeeWeeklyTrend(employeeId: number, weeks = 6) {
        const results: Array<{ week: string; present: number; late: number; absent: number; workHours: number }> = [];

        const todayBd = this.todayDate();
        const todayDay = todayBd.getUTCDay();
        const diffToMon = todayDay === 0 ? -6 : 1 - todayDay;
        const currentWeekMon = new Date(Date.UTC(todayBd.getUTCFullYear(), todayBd.getUTCMonth(), todayBd.getUTCDate() + diffToMon));

        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date(Date.UTC(currentWeekMon.getUTCFullYear(), currentWeekMon.getUTCMonth(), currentWeekMon.getUTCDate() - i * 7));
            const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6));
            const label = weekStart.toISOString().slice(0, 10);

            const rows = await this.prisma.attendance.groupBy({
                by: ['status'],
                where: {
                    employeeId,
                    attendanceDate: { gte: weekStart, lte: weekEnd },
                    deletedAt: null, recordStatus: 'active',
                },
                _count: { id: true },
                _sum: { workHours: true },
            });

            const m = this.groupByToMap(rows);
            const workHours = rows.reduce((s, r) => s + Number(r._sum?.workHours ?? 0), 0);

            results.push({
                week: label,
                present: (m[AttendanceStatus.present] ?? 0) + (m[AttendanceStatus.late] ?? 0),
                late: m[AttendanceStatus.late] ?? 0,
                absent: m[AttendanceStatus.absent] ?? 0,
                workHours: Math.round(workHours * 100) / 100,
            });
        }

        return results;
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private nowBd(): Date {
        return new Date(Date.now() + BD_OFFSET_MS);
    }

    private todayDate(): Date {
        const bd = this.nowBd();
        return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
    }

    private startOfMonthBd(ref: Date): Date {
        return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    }

    private endOfMonthBd(ref: Date): Date {
        return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    }

    private subMonthsBd(ref: Date, n: number): Date {
        return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - n, 1));
    }

    private formatMonth(ref: Date): string {
        const y = ref.getUTCFullYear();
        const m = String(ref.getUTCMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }

    private groupByToMap(rows: Array<{ status: AttendanceStatus; _count: { id: number } }>): Record<string, number> {
        return rows.reduce<Record<string, number>>((acc, r) => {
            acc[r.status] = r._count.id;
            return acc;
        }, {});
    }
}