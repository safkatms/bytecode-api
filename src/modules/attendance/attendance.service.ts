import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AttendanceRepository } from './attendance.repository';
import { EmployeeRepository } from '../employee/employee.repository';
import { DeviceService } from '../device/device.service';
import { CasualLeaveService } from '../casual-leave/casual-leave.service';
import { NotificationService } from '../notification/notification.service';
import {
    AdminMarkAttendanceDto, AdminUpdateAttendanceDto,
    AttendanceFilterDto, CheckInDto, CheckOutDto, MonthlySummaryDto, WeeklyTimesheetDto,
} from './dto/attendance.dto';
import { BadRequestException, ConflictException, NotFoundException } from '../../common/exceptions/app.exception';

// Expected from mobile app headers
export interface MobileContext {
    deviceId: string;       // X-Device-ID header
    deviceName: string | null; // X-Device-Name header (optional, e.g. "Samsung Galaxy S24")
}

// Work starts at 10:00 local wall-clock time (stored as-sent) — anything later is "late"
const WORK_START_HOUR = 10;
const WORK_START_MINUTE = 0;
// After this BD hour (19:00), an open check-in for today triggers the checkout prompt
const CHECKOUT_PROMPT_HOUR = 19;

@Injectable()
export class AttendanceService {
    constructor(
        private readonly attendanceRepo: AttendanceRepository,
        private readonly employeeRepo: EmployeeRepository,
        private readonly deviceService: DeviceService,
        private readonly casualLeaveService: CasualLeaveService,
        private readonly notifications: NotificationService,
    ) { }

    // ─── Employee: Check In ───────────────────────────────────────

    async checkIn(userId: number, dto: CheckInDto, mobile: MobileContext) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');
        if (!employee.isActive) throw new BadRequestException('Your account is inactive. Contact admin.');

        // 1. Validate device (auto-register on first use)
        await this.deviceService.validateAndRegister(employee.id, mobile.deviceId, mobile.deviceName);

        const now = this.parseLocalTime(dto.checkInTime);
        if (isNaN(now.getTime())) throw new BadRequestException('Invalid checkInTime format');

        // 2. Check for duplicate
        const attendanceDate = this.dateOnly(now);
        const existing = await this.attendanceRepo.findByEmployeeAndDate(employee.id, attendanceDate);
        if (existing?.checkInTime) throw new ConflictException('Already checked in for this date');

        const lateMinutes = this.calcLateMinutes(now);
        const status = lateMinutes > 0 ? AttendanceStatus.late : AttendanceStatus.present;

        if (existing) {
            // Record exists (admin pre-created) — fill check-in
            const updated = await this.attendanceRepo.update(existing.id, {
                checkInTime: now,
                checkInLat: dto.latitude,
                checkInLng: dto.longitude,
                status,
                lateMinutes,
                deviceId: mobile.deviceId,
                updatedBy: employee.userId,
            });
            await this.casualLeaveService.grantEarnedLeaveForWorkedDay(employee.id, attendanceDate);
            return updated;
        }

        const created = await this.attendanceRepo.create({
            employeeId: employee.id,
            attendanceDate,
            checkInTime: now,
            checkInLat: dto.latitude,
            checkInLng: dto.longitude,
            status,
            lateMinutes,
            deviceId: mobile.deviceId,
            isManual: false,
            createdBy: employee.userId,
            updatedBy: employee.userId,
        });
        await this.casualLeaveService.grantEarnedLeaveForWorkedDay(employee.id, attendanceDate);
        return created;
    }

    // ─── Employee: Check Out ──────────────────────────────────────

    async checkOut(userId: number, dto: CheckOutDto, mobile: MobileContext) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');

        // Device must already be registered
        await this.deviceService.validateAndRegister(employee.id, mobile.deviceId, mobile.deviceName);

        const now = this.parseLocalTime(dto.checkOutTime);
        if (isNaN(now.getTime())) throw new BadRequestException('Invalid checkOutTime format');

        const attendanceDate = this.dateOnly(now);
        const record = await this.attendanceRepo.findByEmployeeAndDate(employee.id, attendanceDate);
        if (!record?.checkInTime) throw new BadRequestException('You have not checked in for this date');
        if (record.checkOutTime) throw new ConflictException('Already checked out for this date');
        if (now.getTime() <= record.checkInTime.getTime()) throw new BadRequestException('Check-out time must be after check-in time');

        const workHours = this.calcWorkHoursDirect(record.checkInTime, now);

        return this.attendanceRepo.update(record.id, {
            checkOutTime: now,
            checkOutLat: dto.latitude,
            checkOutLng: dto.longitude,
            workHours,
            updatedBy: employee.userId,
        });
    }

    // ─── Employee: My Attendance ──────────────────────────────────

    async getMyAttendance(userId: number, filter: AttendanceFilterDto) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');

        filter.employeeId = employee.id;
        return this.attendanceRepo.findMany(filter);
    }

    async getMyMonthlySummary(userId: number, dto: MonthlySummaryDto) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');
        const [year, month] = dto.month.split('-').map(Number);
        this.assertValidMonth(year, month);
        return this.attendanceRepo.getMonthlySummary(employee.id, year, month);
    }

    async getMyWeeklyTimesheet(userId: number, dto: WeeklyTimesheetDto) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');
        return this.buildWeeklyTimesheet(employee.id, (employee as any).weekendDays ?? [5, 6], dto);
    }

    async adminGetWeeklyTimesheet(employeeId: number, dto: WeeklyTimesheetDto) {
        const employee = await this.employeeRepo.findById(employeeId);
        if (!employee) throw new NotFoundException('Employee');
        return this.buildWeeklyTimesheet(employeeId, (employee as any).weekendDays ?? [5, 6], dto);
    }

    private async buildWeeklyTimesheet(employeeId: number, weekendDays: number[], dto: WeeklyTimesheetDto) {
        const anchor = dto.date ? new Date(dto.date) : this.todayBd();
        const { weekStart, weekEnd } = this.getWeekRange(anchor);

        const records = await this.attendanceRepo.getWeeklyRecords(employeeId, weekStart, weekEnd);
        const recordMap = new Map(records.map((r) => [r.attendanceDate.toISOString().slice(0, 10), r]));

        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const days: any[] = [];
        let totalWorkHours = 0;
        let totalLateMinutes = 0;

        for (let i = 0; i < 7; i++) {
            const d = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + i));
            const key = d.toISOString().slice(0, 10);
            const rec = recordMap.get(key) ?? null;
            const isWeekend = weekendDays.includes(d.getUTCDay());
            const effectiveStatus = rec?.status ?? (isWeekend ? AttendanceStatus.weekend : null);

            totalWorkHours += Number(rec?.workHours ?? 0);
            totalLateMinutes += rec?.lateMinutes ?? 0;

            days.push({
                id: rec?.id ?? null,
                date: key,
                day: DAY_NAMES[d.getUTCDay()],
                isWeekend,
                status: effectiveStatus,
                checkInTime: rec?.checkInTime ?? null,
                checkOutTime: rec?.checkOutTime ?? null,
                workHours: rec?.workHours ?? null,
                lateMinutes: rec?.lateMinutes ?? null,
                isManual: rec?.isManual ?? false,
            });
        }

        return {
            weekStart: weekStart.toISOString().slice(0, 10),
            weekEnd: weekEnd.toISOString().slice(0, 10),
            weekendDays,
            totalWorkHours: Math.round(totalWorkHours * 100) / 100,
            totalLateMinutes,
            presentDays: days.filter((d) => d.status === AttendanceStatus.present).length,
            lateDays: days.filter((d) => d.status === AttendanceStatus.late).length,
            weekendDaysCount: days.filter((d) => d.isWeekend).length,
            absentDays: days.filter((d) => !d.status || d.status === AttendanceStatus.absent).length,
            totalDays: days.length,
            days,
        };
    }

    async getTodayStatus(userId: number) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');
        const today = this.todayBd();
        const record = await this.attendanceRepo.findByEmployeeAndDate(employee.id, today);
        const weekendDays = ((employee as any).weekendDays ?? [5, 6]) as number[];
        const isWeekend = weekendDays.includes(today.getUTCDay());
        return {
            isWeekend,
            checkedIn: !!record?.checkInTime,
            checkedOut: !!record?.checkOutTime,
            checkInTime: record?.checkInTime ?? null,
            checkOutTime: record?.checkOutTime ?? null,
            workHours: record?.workHours ?? null,
            lateMinutes: record?.lateMinutes ?? null,
            status: record?.status ?? (isWeekend ? AttendanceStatus.weekend : null),
        };
    }

    // Days the employee checked in but never checked out: any previous day,
    // plus today once BD time is 19:00 or later. The app should prompt for these on open.
    async getPendingCheckouts(userId: number) {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (!employee) throw new NotFoundException('Employee profile');

        const today = this.todayBd();
        const bdHour = new Date(Date.now() + 6 * 60 * 60 * 1000).getUTCHours();
        const records = await this.attendanceRepo.findOpenCheckIns(employee.id, today);

        const pending = records.filter(
            (r) => r.attendanceDate.getTime() < today.getTime() || bdHour >= CHECKOUT_PROMPT_HOUR,
        );
        return {
            hasPending: pending.length > 0,
            records: pending.map((r) => ({
                id: r.id,
                attendanceDate: r.attendanceDate.toISOString().slice(0, 10),
                checkInTime: r.checkInTime,
            })),
        };
    }

    // ─── Admin: Manual mark ───────────────────────────────────────

    async adminMark(dto: AdminMarkAttendanceDto, adminId: number) {
        const employee = await this.employeeRepo.findById(dto.employeeId);
        if (!employee) throw new NotFoundException('Employee');

        const date = new Date(dto.attendanceDate);
        const existing = await this.attendanceRepo.findByEmployeeAndDate(employee.id, date);
        if (existing) throw new ConflictException('Attendance already exists for this date. Use update instead.');

        // attendanceDate is authoritative: times take its calendar date, keeping only the time of day
        const checkIn = dto.checkInTime ? this.alignToDate(dto.checkInTime, date) : null;
        const checkOut = dto.checkOutTime ? this.alignToDate(dto.checkOutTime, date) : null;
        const workHours = this.calcWorkHours(checkIn, checkOut);

        const created = await this.attendanceRepo.create({
            employeeId: dto.employeeId,
            attendanceDate: date,
            status: dto.status,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            workHours,
            lateMinutes: dto.lateMinutes ?? 0,
            note: dto.note,
            isManual: true,
            deviceId: null,
            createdBy: adminId,
            updatedBy: adminId,
        });
        if (dto.checkInTime) {
            await this.casualLeaveService.grantEarnedLeaveForWorkedDay(employee.id, date);
        }
        void this.notifications.notifyEmployees([employee.id], {
            type: 'attendance_marked',
            title: 'Attendance recorded',
            body: `Admin marked your attendance for ${dto.attendanceDate.slice(0, 10)} as ${dto.status}.`,
            data: { attendanceId: created.id, date: dto.attendanceDate.slice(0, 10) },
        });
        return created;
    }

    async adminUpdate(id: number, dto: AdminUpdateAttendanceDto, adminId: number) {
        const existing = await this.attendanceRepo.findById(id);
        if (!existing) throw new NotFoundException('Attendance record');

        // attendanceDate is authoritative; times (new or already stored) follow its calendar date
        const date = dto.attendanceDate ? new Date(dto.attendanceDate) : existing.attendanceDate;
        const checkIn = dto.checkInTime
            ? this.alignToDate(dto.checkInTime, date)
            : existing.checkInTime ? this.alignToDate(existing.checkInTime, date) : null;
        const checkOut = dto.checkOutTime
            ? this.alignToDate(dto.checkOutTime, date)
            : existing.checkOutTime ? this.alignToDate(existing.checkOutTime, date) : null;
        const workHours = this.calcWorkHours(checkIn, checkOut);

        const updated = await this.attendanceRepo.update(id, {
            ...dto,
            ...(dto.attendanceDate ? { attendanceDate: date } : {}),
            ...(checkIn ? { checkInTime: checkIn } : {}),
            ...(checkOut ? { checkOutTime: checkOut } : {}),
            workHours,
            isManual: true,
            updatedBy: adminId,
        });
        void this.notifications.notifyEmployees([existing.employeeId], {
            type: 'attendance_updated',
            title: 'Attendance updated',
            body: `Admin updated your attendance for ${new Date(updated.attendanceDate).toISOString().slice(0, 10)}.`,
            data: { attendanceId: id },
        });
        return updated;
    }

    async adminFindMany(filter: AttendanceFilterDto) {
        return this.attendanceRepo.findMany(filter);
    }

    async adminFindById(id: number) {
        const record = await this.attendanceRepo.findById(id);
        if (!record) throw new NotFoundException('Attendance record');
        return record;
    }

    async adminGetMonthlySummary(dto: MonthlySummaryDto) {
        const [year, month] = dto.month.split('-').map(Number);
        this.assertValidMonth(year, month);

        if (dto.employeeId) {
            const emp = await this.employeeRepo.findById(dto.employeeId);
            if (!emp) throw new NotFoundException('Employee');
            return this.attendanceRepo.getMonthlySummary(dto.employeeId, year, month);
        }

        // All employees
        const ids = await this.employeeRepo.getActiveIds();
        return Promise.all(
            ids.map(async (id) => {
                const emp = await this.employeeRepo.findById(id);
                const data = await this.attendanceRepo.getMonthlySummary(id, year, month);
                return { employee: emp, ...data };
            }),
        );
    }

    async adminGetDailySummary(date: string) {
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) throw new BadRequestException('Invalid date format');
        return this.attendanceRepo.getDailySummary(parsed);
    }

    async adminRemove(id: number, adminId: number) {
        const record = await this.attendanceRepo.findById(id);
        if (!record) throw new NotFoundException('Attendance record');
        await this.attendanceRepo.update(id, {
            deletedAt: new Date(), deletedBy: adminId, recordStatus: 'deleted', updatedBy: adminId,
        });
        if (record.checkInTime) {
            await this.casualLeaveService.revokeEarnedLeave(record.employeeId, record.attendanceDate);
        }
        void this.notifications.notifyEmployees([record.employeeId], {
            type: 'attendance_removed',
            title: 'Attendance removed',
            body: `Admin removed your attendance record for ${new Date(record.attendanceDate).toISOString().slice(0, 10)}.`,
            data: { attendanceId: id },
        });
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private todayBd(): Date {
        const bdMs = Date.now() + 6 * 60 * 60 * 1000;
        const bd = new Date(bdMs);
        return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
    }

    // Keeps the wall-clock digits exactly as sent by the app: any Z/offset is dropped
    // and the digits are stored as-is (UTC is used only as a neutral container).
    private parseLocalTime(str: string): Date {
        return new Date(str.replace(/(Z|[+-]\d{2}:?\d{2})$/, '') + 'Z');
    }

    // Combines the calendar date of `date` with the time-of-day of `time`
    // (full ISO datetime, "HH:mm[:ss]", or an already-stored Date).
    private alignToDate(time: string | Date, date: Date): Date {
        let t: Date;
        if (time instanceof Date) {
            t = time;
        } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(time.trim())) {
            const [h, m, s = '00'] = time.trim().split(':');
            t = this.parseLocalTime(`1970-01-01T${h.padStart(2, '0')}:${m}:${s}`);
        } else {
            t = this.parseLocalTime(time);
        }
        if (isNaN(t.getTime())) throw new BadRequestException('Invalid time format');
        return new Date(Date.UTC(
            date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
            t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds(),
        ));
    }

    private getWeekRange(anchor: Date): { weekStart: Date; weekEnd: Date } {
        // Week runs Saturday → Friday
        const diffToSat = -((anchor.getUTCDay() + 1) % 7);
        const weekStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + diffToSat));
        const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6));
        return { weekStart, weekEnd };
    }

    // Calendar date of the stored wall-clock time, as UTC midnight
    private dateOnly(d: Date): Date {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    private calcLateMinutes(checkIn: Date): number {
        const day = this.dateOnly(checkIn);
        const deadlineMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), WORK_START_HOUR, WORK_START_MINUTE);
        const diff = checkIn.getTime() - deadlineMs;
        return diff > 0 ? Math.floor(diff / 60_000) : 0;
    }

    private calcWorkHoursDirect(checkIn: Date, checkOut: Date): number | null {
        const diff = checkOut.getTime() - checkIn.getTime();
        return diff > 0 ? Math.round((diff / 3_600_000) * 100) / 100 : null;
    }

    private calcWorkHours(checkIn?: string | Date | null, checkOut?: string | Date | null): number | null {
        if (!checkIn || !checkOut) return null;
        const toDate = (v: string | Date) => (typeof v === 'string' ? this.parseLocalTime(v) : v);
        const diff = toDate(checkOut).getTime() - toDate(checkIn).getTime();
        return diff > 0 ? Math.round((diff / 3_600_000) * 100) / 100 : null;
    }

    private assertValidMonth(year: number, month: number) {
        if (!year || !month || month < 1 || month > 12) {
            throw new BadRequestException('Invalid month. Use YYYY-MM format');
        }
    }
}
