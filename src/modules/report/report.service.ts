import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { BadRequestException } from '../../common/exceptions/app.exception';
import { EmailAttendanceReportDto, ReportRange, ReportScope } from './dto/report.dto';
import {
    buildAttendanceWorkbook, lastWeekRange, thisMonthRange, todayBd, ymd,
    ReportEmployee, ReportRecord,
} from './attendance-report.builder';

const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

@Injectable()
export class ReportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
    ) { }

    async emailAttendanceReport(dto: EmailAttendanceReportDto) {
        if (!this.mail.enabled) {
            throw new BadRequestException('Email is not configured on the server (GMAIL_USER / GMAIL_APP_PASSWORD)');
        }

        const { start, end } = this.resolveRange(dto);

        const recipients = await this.prisma.user.findMany({
            where: { id: { in: dto.recipientUserIds }, isActive: true, deletedAt: null },
            select: { email: true },
        });
        if (!recipients.length) throw new BadRequestException('No valid recipients selected');

        const employees = await this.loadEmployees(dto);
        if (!employees.length) throw new BadRequestException('No active employees match this filter');

        const records = await this.loadRecords(employees.map((e) => e.id), start, end);
        const report = await buildAttendanceWorkbook(employees, records, start, end, todayBd());

        const label = `${ymd(start)} to ${ymd(end)}`;
        const filename = `attendance-report_${ymd(start)}_to_${ymd(end)}.xlsx`;
        const subject = `Attendance report: ${label}`;
        const text = `Attendance report for ${label}.\n${report.employees} employee(s), ${report.weeks} week(s). Weeks run Monday to Sunday; the Summary tab has totals and each week has its own tab.`;
        const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h3>Attendance report</h3><p><b>${label}</b><br/>${report.employees} employee(s) &middot; ${report.weeks} week(s)</p><p>Weeks run Monday to Sunday. The <i>Summary</i> tab has totals and each week has its own tab. The Excel file is attached.</p></div>`;
        const attachments = [{
            filename,
            content: report.buffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }];

        const results = await Promise.all(
            recipients.map((r) => this.mail.send(r.email, subject, html, text, attachments)),
        );
        const sent = results.filter(Boolean).length;
        if (sent === 0) throw new BadRequestException('Failed to send the report email');

        return {
            range: { startDate: ymd(start), endDate: ymd(end) },
            employees: report.employees,
            weeks: report.weeks,
            sent,
            failed: results.length - sent,
        };
    }

    private resolveRange(dto: EmailAttendanceReportDto) {
        const today = todayBd();
        if (dto.range === ReportRange.LAST_WEEK) return lastWeekRange(today);
        if (dto.range === ReportRange.THIS_MONTH) return thisMonthRange(today);

        if (!dto.startDate || !dto.endDate) {
            throw new BadRequestException('startDate and endDate are required for a custom range');
        }
        const start = new Date(`${dto.startDate.slice(0, 10)}T00:00:00Z`);
        const end = new Date(`${dto.endDate.slice(0, 10)}T00:00:00Z`);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Invalid date');
        if (end < start) throw new BadRequestException('End date must be on or after start date');
        if ((end.getTime() - start.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
            throw new BadRequestException(`Range cannot exceed ${MAX_RANGE_DAYS} days`);
        }
        return { start, end };
    }

    private async loadEmployees(dto: EmailAttendanceReportDto): Promise<ReportEmployee[]> {
        if (dto.scope !== ReportScope.ALL && !dto.ids?.length) {
            throw new BadRequestException('ids are required for this scope');
        }

        const where: Prisma.EmployeeWhereInput = {
            deletedAt: null, recordStatus: 'active', isActive: true,
            ...(dto.scope === ReportScope.DEPARTMENT && { departmentId: { in: dto.ids } }),
            ...(dto.scope === ReportScope.TEAM && { teamId: { in: dto.ids } }),
            ...(dto.scope === ReportScope.EMPLOYEES && { id: { in: dto.ids } }),
        };

        const rows = await this.prisma.employee.findMany({
            where,
            orderBy: { employeeCode: 'asc' },
            select: {
                id: true, employeeCode: true, weekendDays: true,
                user: { select: { firstName: true, lastName: true, email: true } },
                department: { select: { name: true } },
                team: { select: { name: true } },
            },
        });

        return rows.map((e) => ({
            id: e.id,
            code: e.employeeCode,
            name: [e.user.firstName, e.user.lastName].filter(Boolean).join(' ') || e.user.email,
            department: e.department?.name ?? null,
            team: e.team?.name ?? null,
            weekendDays: e.weekendDays as number[],
        }));
    }

    private async loadRecords(employeeIds: number[], start: Date, end: Date): Promise<ReportRecord[]> {
        const rows = await this.prisma.attendance.findMany({
            where: {
                employeeId: { in: employeeIds },
                attendanceDate: { gte: start, lte: end },
                deletedAt: null,
                recordStatus: 'active',
            },
            select: {
                employeeId: true, attendanceDate: true, status: true,
                checkInTime: true, checkOutTime: true, workHours: true,
            },
        });

        return rows.map((r) => ({
            employeeId: r.employeeId,
            date: ymd(r.attendanceDate),
            status: r.status,
            checkIn: r.checkInTime,
            checkOut: r.checkOutTime,
            workHours: r.workHours === null ? null : Number(r.workHours),
        }));
    }
}
