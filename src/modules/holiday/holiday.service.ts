import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HolidayRepository } from './holiday.repository';
import { NotificationService } from '../notification/notification.service';
import { CreateHolidayDto, HolidayFilterDto, UpdateHolidayDto } from './dto/holiday.dto';
import { BadRequestException, ConflictException, NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class HolidayService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly repo: HolidayRepository,
        private readonly notifications: NotificationService,
    ) { }

    async create(dto: CreateHolidayDto, adminId: number) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (endDate < startDate) throw new BadRequestException('End date must be on or after start date');

        const overlap = await this.repo.findOverlapping(startDate, endDate);
        if (overlap) throw new ConflictException(`Date range overlaps with existing holiday "${overlap.name}"`);

        const holiday = await this.repo.create({
            name: dto.name,
            startDate,
            endDate,
            description: dto.description,
            createdBy: adminId,
            updatedBy: adminId,
        });

        await this.repo.replaceExclusions(
            holiday.id,
            dto.excludeEmployeeIds ?? [],
            dto.excludeTeamIds ?? [],
        );

        await this.applyAttendanceEntries(holiday.id, startDate, endDate, adminId);

        void this.notifyHoliday(holiday.id, 'holiday_created', 'New holiday', holiday.name, startDate, endDate);
        return this.repo.findById(holiday.id);
    }

    async update(id: number, dto: UpdateHolidayDto, adminId: number) {
        const holiday = await this.repo.findById(id);
        if (!holiday) throw new NotFoundException('Holiday');

        const newStart = dto.startDate ? new Date(dto.startDate) : holiday.startDate;
        const newEnd   = dto.endDate   ? new Date(dto.endDate)   : holiday.endDate;

        if (newEnd < newStart) throw new BadRequestException('End date must be on or after start date');

        if (dto.startDate || dto.endDate) {
            const overlap = await this.repo.findOverlapping(newStart, newEnd, id);
            if (overlap) throw new ConflictException(`Date range overlaps with existing holiday "${overlap.name}"`);
        }

        await this.repo.update(id, {
            ...(dto.name && { name: dto.name }),
            ...(dto.startDate && { startDate: newStart }),
            ...(dto.endDate   && { endDate: newEnd }),
            ...(dto.description !== undefined && { description: dto.description }),
            updatedBy: adminId,
        });

        const exclusionsChanged = dto.excludeEmployeeIds !== undefined || dto.excludeTeamIds !== undefined;

        if (exclusionsChanged) {
            await this.repo.replaceExclusions(
                id,
                dto.excludeEmployeeIds ?? [],
                dto.excludeTeamIds ?? [],
            );
        }

        if (exclusionsChanged || dto.startDate || dto.endDate) {
            // Remove old attendance entries and recreate
            await this.prisma.attendance.deleteMany({ where: { holidayId: id } });
            await this.applyAttendanceEntries(id, newStart, newEnd, adminId);
        }

        void this.notifyHoliday(id, 'holiday_updated', 'Holiday updated', dto.name ?? holiday.name, newStart, newEnd);
        return this.repo.findById(id);
    }

    async remove(id: number, adminId: number) {
        const holiday = await this.repo.findById(id);
        if (!holiday) throw new NotFoundException('Holiday');

        await this.prisma.attendance.deleteMany({ where: { holidayId: id } });

        const removed = await this.repo.update(id, {
            deletedAt: new Date(),
            deletedBy: adminId,
            recordStatus: 'deleted',
            updatedBy: adminId,
        });

        void this.notifyHoliday(id, 'holiday_removed', 'Holiday cancelled', holiday.name, holiday.startDate, holiday.endDate);
        return removed;
    }

    async findAll(filter: HolidayFilterDto) {
        return this.repo.search(filter);
    }

    async findOne(id: number) {
        const holiday = await this.repo.findById(id);
        if (!holiday) throw new NotFoundException('Holiday');
        return holiday;
    }

    // ─── Helpers ──────────────────────────────────────────────────

    /** Notifies every active employee who is not excluded from this holiday. */
    private async notifyHoliday(
        holidayId: number,
        type: 'holiday_created' | 'holiday_updated' | 'holiday_removed',
        title: string,
        name: string,
        start: Date,
        end: Date,
    ) {
        try {
            const exclusions = await this.prisma.holidayExclusion.findMany({
                where: { holidayId },
                include: { team: { select: { members: { select: { id: true } } } } },
            });
            const excluded = new Set<number>();
            for (const ex of exclusions) {
                if (ex.employeeId) excluded.add(ex.employeeId);
                if (ex.team) ex.team.members.forEach((m) => excluded.add(m.id));
            }

            const employees = await this.prisma.employee.findMany({
                where: { deletedAt: null, recordStatus: 'active', isActive: true },
                select: { id: true },
            });

            const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);
            const range = ymd(start) === ymd(end) ? ymd(start) : `${ymd(start)} to ${ymd(end)}`;

            await this.notifications.notifyEmployees(
                employees.map((e) => e.id).filter((id) => !excluded.has(id)),
                { type, title, body: `${name} (${range})`, data: { holidayId } },
            );
        } catch {
            // notifications are best-effort
        }
    }

    /**
     * Creates attendance entries (status=holiday) for every active employee
     * who is NOT excluded, for each calendar day in [startDate, endDate] that
     * is NOT a weekend for that specific employee.
     */
    private async applyAttendanceEntries(
        holidayId: number,
        startDate: Date,
        endDate: Date,
        adminId: number,
    ) {
        // Resolve excluded employee IDs (direct + via team)
        const exclusions = await this.prisma.holidayExclusion.findMany({
            where: { holidayId },
            include: { team: { select: { members: { select: { id: true } } } } },
        });

        const excludedIds = new Set<number>();
        for (const ex of exclusions) {
            if (ex.employeeId) excludedIds.add(ex.employeeId);
            if (ex.team) ex.team.members.forEach((m) => excludedIds.add(m.id));
        }

        // Load all active employees with their weekend config
        const employees = await this.prisma.employee.findMany({
            where: { deletedAt: null, recordStatus: 'active', isActive: true },
            select: { id: true, weekendDays: true },
        });

        // Iterate each day in the range
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
            const date = new Date(cursor);
            const dayOfWeek = date.getUTCDay();

            for (const emp of employees) {
                if (excludedIds.has(emp.id)) continue;

                const weekendDays = emp.weekendDays as number[];
                // Skip: this day is a weekend for this employee
                if (weekendDays.includes(dayOfWeek)) continue;

                const existing = await this.prisma.attendance.findFirst({
                    where: { employeeId: emp.id, attendanceDate: date },
                });

                if (existing) {
                    if (!existing.checkInTime) {
                        await this.prisma.attendance.update({
                            where: { id: existing.id },
                            data: { status: 'holiday', isManual: true, holidayId, updatedBy: adminId },
                        });
                    }
                } else {
                    await this.prisma.attendance.create({
                        data: {
                            employeeId: emp.id,
                            attendanceDate: date,
                            status: 'holiday',
                            isManual: true,
                            holidayId,
                            createdBy: adminId,
                            updatedBy: adminId,
                        },
                    });
                }
            }

            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }
}
