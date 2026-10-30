import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { SickLeaveRepository } from './sick-leave.repository';
import { AdjustSickLeaveBalanceDto, AdminMarkSickLeaveDto, ApplySickLeaveDto, ReviewSickLeaveDto, SetSickLeavePolicyDto, SickLeaveBalanceFilterDto, SickLeaveFilterDto } from './dto/sick-leave.dto';
import {
    BadRequestException, ConflictException, ForbiddenException, NotFoundException,
} from '../../common/exceptions/app.exception';

@Injectable()
export class SickLeaveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly repo: SickLeaveRepository,
    ) { }

    // ─── Policy ───────────────────────────────────────────────────

    async setPolicy(dto: SetSickLeavePolicyDto, adminId: number) {
        return this.repo.upsertPolicy(dto.year, dto.totalDays, adminId);
    }

    async getPolicy(year: number) {
        const policy = await this.repo.getPolicy(year);
        if (!policy) throw new NotFoundException('Sick leave policy');
        return policy;
    }

    // ─── Employee: Apply ──────────────────────────────────────────

    async apply(userId: number, dto: ApplySickLeaveDto) {
        const employee = await this.findActiveEmployee(userId);

        const start = new Date(dto.startDate);
        const end = new Date(dto.endDate);

        if (end < start) throw new BadRequestException('End date must be on or after start date');

        const year = start.getFullYear();
        if (end.getFullYear() !== year) {
            throw new BadRequestException('Start and end date must be in the same calendar year');
        }

        // Ensure policy exists for the year
        const policy = await this.repo.getActivePolicyYear(year);
        if (!policy) {
            throw new BadRequestException(`No sick leave policy defined for ${year}. Contact admin.`);
        }

        const totalDays = this.countWeekdays(start, end, employee.weekendDays);
        if (totalDays === 0) throw new BadRequestException('Selected dates fall entirely on weekends');

        // Ensure balance record exists
        await this.repo.upsertBalance(employee.id, year, policy.totalDays);
        const balance = await this.repo.findBalance(employee.id, year);
        const remaining = balance!.totalDays - balance!.usedDays;

        if (totalDays > remaining) {
            throw new BadRequestException(
                `Insufficient sick leave balance. Requested: ${totalDays}, available: ${remaining}`,
            );
        }

        // Check for overlapping approved/pending requests
        const overlap = await this.repo.findOverlapping(employee.id, start, end);
        if (overlap) throw new ConflictException('You already have a sick leave request overlapping these dates');

        return this.repo.create({
            employeeId: employee.id,
            startDate: start,
            endDate: end,
            totalDays,
            reason: dto.reason,
            status: 'pending',
            createdBy: employee.userId,
            updatedBy: employee.userId,
        });
    }

    async cancelRequest(userId: number, requestId: number) {
        const employee = await this.findActiveEmployee(userId);
        const request = await this.repo.findById(requestId);

        if (!request) throw new NotFoundException('Sick leave request');
        if (request.employeeId !== employee.id) throw new ForbiddenException();
        if (request.status !== 'pending') {
            throw new BadRequestException('Only pending requests can be cancelled');
        }

        return this.repo.update(requestId, { status: 'cancelled', updatedBy: employee.userId });
    }

    async getMyRequests(userId: number, filter: SickLeaveFilterDto) {
        const employee = await this.findActiveEmployee(userId);
        filter.employeeId = employee.id;
        return this.repo.search(filter);
    }

    async getMyBalance(userId: number, year?: number) {
        const employee = await this.findActiveEmployee(userId);
        const y = year ?? new Date().getFullYear();
        const balance = await this.repo.findBalance(employee.id, y);
        const policy = await this.repo.getActivePolicyYear(y);

        return {
            year: y,
            totalDays: balance?.totalDays ?? policy?.totalDays ?? null,
            usedDays: balance?.usedDays ?? 0,
            remainingDays: balance
                ? balance.totalDays - balance.usedDays
                : (policy?.totalDays ?? null),
        };
    }

    // ─── Admin: Review ────────────────────────────────────────────

    async review(requestId: number, dto: ReviewSickLeaveDto, adminUserId: number) {
        const request = await this.repo.findById(requestId);
        if (!request) throw new NotFoundException('Sick leave request');
        if (request.status !== 'pending') {
            throw new BadRequestException('Only pending requests can be reviewed');
        }

        if (dto.action === 'approved') {
            // Re-check balance at review time (another request may have been approved meanwhile)
            const year = new Date(request.startDate).getFullYear();
            const balance = await this.repo.findBalance(request.employeeId, year);
            const remaining = (balance?.totalDays ?? 0) - (balance?.usedDays ?? 0);

            if (request.totalDays > remaining) {
                throw new BadRequestException(
                    `Employee has insufficient balance (${remaining} days left) to approve this request`,
                );
            }

            // Create attendance entries for each working day in the range
            await this.createAttendanceEntries(request, adminUserId);

            // Deduct from balance
            await this.repo.incrementUsedDays(request.employeeId, year, request.totalDays);
        }

        return this.repo.update(requestId, {
            status: dto.action,
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
            reviewNote: dto.reviewNote,
            updatedBy: adminUserId,
        });
    }

    async adminMarkSickLeave(dto: AdminMarkSickLeaveDto, adminUserId: number) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: dto.employeeId, deletedAt: null, recordStatus: 'active' },
        });
        if (!employee) throw new NotFoundException('Employee');

        const date = new Date(dto.date);
        const year = date.getFullYear();

        // Ensure policy + balance exist
        const policy = await this.repo.getActivePolicyYear(year);
        if (policy) {
            await this.repo.upsertBalance(employee.id, year, policy.totalDays);
            const balance = await this.repo.findBalance(employee.id, year);
            const remaining = (balance?.totalDays ?? 0) - (balance?.usedDays ?? 0);
            if (remaining < 1) {
                throw new BadRequestException(
                    `Employee has no remaining sick leave balance for ${year}`,
                );
            }
        }

        // Check for an existing overlapping request on this single day
        const overlap = await this.repo.findOverlapping(employee.id, date, date);
        if (overlap) throw new ConflictException('A sick leave request already exists for this date');

        // Create an already-approved request record
        const request = await this.repo.create({
            employeeId: employee.id,
            startDate: date,
            endDate: date,
            totalDays: 1,
            reason: dto.note,
            status: 'approved',
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
            reviewNote: 'Marked directly by admin',
            createdBy: adminUserId,
            updatedBy: adminUserId,
        });

        // Create / update the attendance entry
        const existing = await this.prisma.attendance.findFirst({
            where: { employeeId: employee.id, attendanceDate: date },
        });

        if (existing) {
            if (existing.checkInTime) {
                throw new ConflictException('Employee already checked in for this date. Cannot mark as sick leave.');
            }
            await this.prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    status: 'sick_leave',
                    isManual: true,
                    note: dto.note,
                    sickLeaveRequestId: request.id,
                    updatedBy: adminUserId,
                },
            });
        } else {
            await this.prisma.attendance.create({
                data: {
                    employeeId: employee.id,
                    attendanceDate: date,
                    status: 'sick_leave',
                    isManual: true,
                    note: dto.note,
                    sickLeaveRequestId: request.id,
                    createdBy: adminUserId,
                    updatedBy: adminUserId,
                },
            });
        }

        // Deduct balance only when a policy exists
        if (policy) {
            await this.repo.incrementUsedDays(employee.id, year, 1);
        }

        return request;
    }

    async getEmployeeBalance(employeeId: number, year?: number) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: employeeId, deletedAt: null, recordStatus: 'active' },
            select: {
                id: true, employeeCode: true, designation: true,
                user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
            },
        });
        if (!employee) throw new NotFoundException('Employee');

        const y = year ?? new Date().getFullYear();
        const policy = await this.repo.getActivePolicyYear(y);

        if (policy) {
            await this.repo.upsertBalance(employeeId, y, policy.totalDays);
        }

        const balance = await this.repo.findBalance(employeeId, y);

        return {
            employee,
            year: y,
            totalDays: balance?.totalDays ?? policy?.totalDays ?? null,
            usedDays: balance?.usedDays ?? 0,
            remainingDays: balance
                ? balance.totalDays - balance.usedDays
                : (policy?.totalDays ?? null),
        };
    }

    /** Opening-balance correction: overwrite usedDays for leave taken before the app was in use. */
    async adjustBalance(employeeId: number, dto: AdjustSickLeaveBalanceDto) {
        const policy = await this.repo.getActivePolicyYear(dto.year);
        if (!policy) {
            throw new BadRequestException(`No sick leave policy defined for ${dto.year}`);
        }

        const employee = await this.prisma.employee.findFirst({
            where: { id: employeeId, deletedAt: null, recordStatus: 'active' },
        });
        if (!employee) throw new NotFoundException('Employee');

        const balance = await this.repo.upsertBalance(employeeId, dto.year, policy.totalDays);
        if (dto.usedDays > balance.totalDays) {
            throw new BadRequestException(
                `usedDays (${dto.usedDays}) cannot exceed total entitlement (${balance.totalDays})`,
            );
        }

        await this.repo.setUsedDays(employeeId, dto.year, dto.usedDays);
        return this.getEmployeeBalance(employeeId, dto.year);
    }

    /** Paginated sick leave balances for all active employees (read-only, creates no rows). */
    async listBalances(filter: SickLeaveBalanceFilterDto) {
        const { page = 1, limit = 10, search } = filter;
        const year = filter.year ?? new Date().getFullYear();

        const where: Prisma.EmployeeWhereInput = {
            deletedAt: null,
            recordStatus: 'active',
            ...(search && {
                OR: [
                    { employeeCode: { contains: search, mode: 'insensitive' } },
                    { user: { firstName: { contains: search, mode: 'insensitive' } } },
                    { user: { lastName: { contains: search, mode: 'insensitive' } } },
                    { user: { email: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        };

        const [employees, total, policy] = await Promise.all([
            this.prisma.employee.findMany({
                where, skip: filter.skip, take: limit,
                orderBy: { employeeCode: 'asc' },
                select: {
                    id: true, employeeCode: true, designation: true,
                    user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
                },
            }),
            this.prisma.employee.count({ where }),
            this.repo.getActivePolicyYear(year),
        ]);

        const balances = await this.prisma.sickLeaveBalance.findMany({
            where: { employeeId: { in: employees.map((e) => e.id) }, year },
        });
        const balanceMap = new Map(balances.map((b) => [b.employeeId, b]));

        const data = employees.map((employee) => {
            const balance = balanceMap.get(employee.id);
            const totalDays = balance?.totalDays ?? policy?.totalDays ?? null;
            const usedDays = balance?.usedDays ?? 0;
            return {
                employee, year, totalDays, usedDays,
                remainingDays: totalDays !== null ? totalDays - usedDays : null,
            };
        });

        return new PaginatedResponse(data, total, page, limit);
    }

    async listRequests(filter: SickLeaveFilterDto) {
        return this.repo.search(filter);
    }

    async getRequestById(id: number) {
        const request = await this.repo.findById(id);
        if (!request) throw new NotFoundException('Sick leave request');
        return request;
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private async createAttendanceEntries(request: any, adminUserId: number) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: request.employeeId },
        });
        if (!employee) return;

        const start = new Date(request.startDate);
        const end = new Date(request.endDate);
        const weekends = employee.weekendDays as number[];

        const dates: Date[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            if (!weekends.includes(cursor.getDay())) {
                dates.push(new Date(cursor));
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        for (const date of dates) {
            const existing = await this.prisma.attendance.findFirst({
                where: { employeeId: request.employeeId, attendanceDate: date },
            });

            if (existing) {
                // Overwrite only if not already a real check-in
                if (!existing.checkInTime) {
                    await this.prisma.attendance.update({
                        where: { id: existing.id },
                        data: {
                            status: 'sick_leave',
                            isManual: true,
                            sickLeaveRequestId: request.id,
                            updatedBy: adminUserId,
                        },
                    });
                }
            } else {
                await this.prisma.attendance.create({
                    data: {
                        employeeId: request.employeeId,
                        attendanceDate: date,
                        status: 'sick_leave',
                        isManual: true,
                        sickLeaveRequestId: request.id,
                        createdBy: adminUserId,
                        updatedBy: adminUserId,
                    },
                });
            }
        }
    }

    private countWeekdays(start: Date, end: Date, weekendDays: number[]): number {
        let count = 0;
        const cursor = new Date(start);
        while (cursor <= end) {
            if (!weekendDays.includes(cursor.getDay())) count++;
            cursor.setDate(cursor.getDate() + 1);
        }
        return count;
    }

    private async findActiveEmployee(userId: number) {
        const employee = await this.prisma.employee.findFirst({
            where: { userId, deletedAt: null, recordStatus: 'active' },
        });
        if (!employee) throw new NotFoundException('Employee profile');
        if (!employee.isActive) throw new BadRequestException('Your account is inactive. Contact admin.');
        return employee;
    }
}
