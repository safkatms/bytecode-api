import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CasualLeaveRepository } from './casual-leave.repository';
import {
    AdminMarkCasualLeaveDto, ApplyCasualLeaveDto, CasualLeaveFilterDto,
    ReviewCasualLeaveDto, SetCasualLeavePolicyDto,
} from './dto/casual-leave.dto';
import {
    BadRequestException, ConflictException, ForbiddenException, NotFoundException,
} from '../../common/exceptions/app.exception';

@Injectable()
export class CasualLeaveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly repo: CasualLeaveRepository,
    ) { }

    // ─── Policy ───────────────────────────────────────────────────

    async setPolicy(dto: SetCasualLeavePolicyDto, adminId: number) {
        return this.repo.upsertPolicy(dto.year, dto.totalDays, dto.maxCarryForward, adminId);
    }

    async getPolicy(year: number) {
        const policy = await this.repo.getPolicy(year);
        if (!policy) throw new NotFoundException('Casual leave policy');
        return policy;
    }

    // ─── Employee: Apply ──────────────────────────────────────────

    async apply(userId: number, dto: ApplyCasualLeaveDto) {
        const employee = await this.findActiveEmployee(userId);

        const start = new Date(dto.startDate);
        const end = new Date(dto.endDate);

        if (end < start) throw new BadRequestException('End date must be on or after start date');

        const year = start.getFullYear();
        if (end.getFullYear() !== year) {
            throw new BadRequestException('Start and end date must be in the same calendar year');
        }

        const policy = await this.repo.getActivePolicyYear(year);
        if (!policy) {
            throw new BadRequestException(`No casual leave policy defined for ${year}. Contact admin.`);
        }

        const totalDays = this.countWeekdays(start, end, employee.weekendDays as number[]);
        if (totalDays === 0) throw new BadRequestException('Selected dates fall entirely on weekends');

        // Ensure balance exists (with carry-forward applied)
        await this.ensureBalance(employee.id, year, policy.totalDays, policy.maxCarryForward);
        const balance = await this.repo.findBalance(employee.id, year);
        const remaining = balance!.allocatedDays + balance!.carryForwardDays - balance!.usedDays;

        if (totalDays > remaining) {
            throw new BadRequestException(
                `Insufficient casual leave balance. Requested: ${totalDays}, available: ${remaining}`,
            );
        }

        const overlap = await this.repo.findOverlapping(employee.id, start, end);
        if (overlap) throw new ConflictException('You already have a casual leave request overlapping these dates');

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

        if (!request) throw new NotFoundException('Casual leave request');
        if (request.employeeId !== employee.id) throw new ForbiddenException();
        if (request.status !== 'pending') {
            throw new BadRequestException('Only pending requests can be cancelled');
        }

        return this.repo.update(requestId, { status: 'cancelled', updatedBy: employee.userId });
    }

    async getMyRequests(userId: number, filter: CasualLeaveFilterDto) {
        const employee = await this.findActiveEmployee(userId);
        filter.employeeId = employee.id;
        return this.repo.search(filter);
    }

    async getMyBalance(userId: number, year?: number) {
        const employee = await this.findActiveEmployee(userId);
        const y = year ?? new Date().getFullYear();
        const policy = await this.repo.getActivePolicyYear(y);

        if (policy) {
            await this.ensureBalance(employee.id, y, policy.totalDays, policy.maxCarryForward);
        }

        const balance = await this.repo.findBalance(employee.id, y);
        const totalDays = balance
            ? balance.allocatedDays + balance.carryForwardDays
            : (policy?.totalDays ?? null);

        return {
            year: y,
            allocatedDays: balance?.allocatedDays ?? policy?.totalDays ?? null,
            carryForwardDays: balance?.carryForwardDays ?? 0,
            totalDays,
            usedDays: balance?.usedDays ?? 0,
            remainingDays: totalDays !== null ? totalDays - (balance?.usedDays ?? 0) : null,
        };
    }

    // ─── Admin: Review ────────────────────────────────────────────

    async review(requestId: number, dto: ReviewCasualLeaveDto, adminUserId: number) {
        const request = await this.repo.findById(requestId);
        if (!request) throw new NotFoundException('Casual leave request');
        if (request.status !== 'pending') {
            throw new BadRequestException('Only pending requests can be reviewed');
        }

        if (dto.action === 'approved') {
            const year = new Date(request.startDate).getFullYear();
            const balance = await this.repo.findBalance(request.employeeId, year);
            const remaining = (balance?.allocatedDays ?? 0) + (balance?.carryForwardDays ?? 0) - (balance?.usedDays ?? 0);

            if (request.totalDays > remaining) {
                throw new BadRequestException(
                    `Employee has insufficient balance (${remaining} days left) to approve this request`,
                );
            }

            await this.createAttendanceEntries(request, adminUserId);
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

    async adminMarkCasualLeave(dto: AdminMarkCasualLeaveDto, adminUserId: number) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: dto.employeeId, deletedAt: null, recordStatus: 'active' },
        });
        if (!employee) throw new NotFoundException('Employee');

        const date = new Date(dto.date);
        const year = date.getFullYear();

        const policy = await this.repo.getActivePolicyYear(year);
        if (policy) {
            await this.ensureBalance(employee.id, year, policy.totalDays, policy.maxCarryForward);
            const balance = await this.repo.findBalance(employee.id, year);
            const remaining = (balance?.allocatedDays ?? 0) + (balance?.carryForwardDays ?? 0) - (balance?.usedDays ?? 0);
            if (remaining < 1) {
                throw new BadRequestException(`Employee has no remaining casual leave balance for ${year}`);
            }
        }

        const overlap = await this.repo.findOverlapping(employee.id, date, date);
        if (overlap) throw new ConflictException('A casual leave request already exists for this date');

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

        const existing = await this.prisma.attendance.findFirst({
            where: { employeeId: employee.id, attendanceDate: date },
        });

        if (existing) {
            if (existing.checkInTime) {
                throw new ConflictException('Employee already checked in for this date. Cannot mark as casual leave.');
            }
            await this.prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    status: 'casual_leave',
                    isManual: true,
                    note: dto.note,
                    casualLeaveRequestId: request.id,
                    updatedBy: adminUserId,
                },
            });
        } else {
            await this.prisma.attendance.create({
                data: {
                    employeeId: employee.id,
                    attendanceDate: date,
                    status: 'casual_leave',
                    isManual: true,
                    note: dto.note,
                    casualLeaveRequestId: request.id,
                    createdBy: adminUserId,
                    updatedBy: adminUserId,
                },
            });
        }

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
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        if (!employee) throw new NotFoundException('Employee');

        const y = year ?? new Date().getFullYear();
        const policy = await this.repo.getActivePolicyYear(y);

        if (policy) {
            await this.ensureBalance(employeeId, y, policy.totalDays, policy.maxCarryForward);
        }

        const balance = await this.repo.findBalance(employeeId, y);
        const totalDays = balance
            ? balance.allocatedDays + balance.carryForwardDays
            : (policy?.totalDays ?? null);

        return {
            employee,
            year: y,
            allocatedDays: balance?.allocatedDays ?? policy?.totalDays ?? null,
            carryForwardDays: balance?.carryForwardDays ?? 0,
            totalDays,
            usedDays: balance?.usedDays ?? 0,
            remainingDays: totalDays !== null ? totalDays - (balance?.usedDays ?? 0) : null,
        };
    }

    async listRequests(filter: CasualLeaveFilterDto) {
        return this.repo.search(filter);
    }

    async getRequestById(id: number) {
        const request = await this.repo.findById(id);
        if (!request) throw new NotFoundException('Casual leave request');
        return request;
    }

    // ─── Carry-Forward ────────────────────────────────────────────

    /**
     * Ensures a balance record exists for (employeeId, year).
     * On first creation, computes carry-forward from the previous year's leftover
     * (capped at maxCarryForward from policy).
     */
    private async ensureBalance(
        employeeId: number,
        year: number,
        allocatedDays: number,
        maxCarryForward: number,
    ) {
        const existing = await this.repo.findBalance(employeeId, year);
        if (existing) return existing;

        const prevBalance = await this.repo.findBalance(employeeId, year - 1);
        let carryForward = 0;

        if (prevBalance) {
            const prevRemaining = prevBalance.allocatedDays + prevBalance.carryForwardDays - prevBalance.usedDays;
            carryForward = Math.min(maxCarryForward, Math.max(0, prevRemaining));
        }

        return this.repo.upsertBalance(employeeId, year, allocatedDays, carryForward);
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private async createAttendanceEntries(request: any, adminUserId: number) {
        const employee = await this.prisma.employee.findUnique({ where: { id: request.employeeId } });
        if (!employee) return;

        const weekends = employee.weekendDays as number[];
        const start = new Date(request.startDate);
        const end = new Date(request.endDate);

        const cursor = new Date(start);
        while (cursor <= end) {
            if (!weekends.includes(cursor.getDay())) {
                const date = new Date(cursor);
                const existing = await this.prisma.attendance.findFirst({
                    where: { employeeId: request.employeeId, attendanceDate: date },
                });

                if (existing) {
                    if (!existing.checkInTime) {
                        await this.prisma.attendance.update({
                            where: { id: existing.id },
                            data: {
                                status: 'casual_leave',
                                isManual: true,
                                casualLeaveRequestId: request.id,
                                updatedBy: adminUserId,
                            },
                        });
                    }
                } else {
                    await this.prisma.attendance.create({
                        data: {
                            employeeId: request.employeeId,
                            attendanceDate: date,
                            status: 'casual_leave',
                            isManual: true,
                            casualLeaveRequestId: request.id,
                            createdBy: adminUserId,
                            updatedBy: adminUserId,
                        },
                    });
                }
            }
            cursor.setDate(cursor.getDate() + 1);
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
