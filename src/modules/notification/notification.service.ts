import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { BadRequestException, NotFoundException } from '../../common/exceptions/app.exception';
import {
    BroadcastDto, BroadcastTarget, NotificationFilterDto, RegisterPushTokenDto,
} from './dto/notification.dto';

export interface NotifyPayload {
    type: NotificationType;
    title: string;
    body: string;
    /** Free-form JSON the app uses for deep links, e.g. { requestId: 12, kind: 'casual' } */
    data?: Record<string, unknown>;
    /** Also deliver by email (default false) */
    email?: boolean;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly config: ConfigService,
    ) { }

    // ─── Dispatch (used by other modules) ─────────────────────────
    // None of these throw: a notification failure must never break the business action.

    async notifyUsers(userIds: number[], payload: NotifyPayload): Promise<void> {
        try {
            const ids = [...new Set(userIds)];
            if (!ids.length) return;

            const users = await this.prisma.user.findMany({
                where: { id: { in: ids }, isActive: true, deletedAt: null },
                select: { id: true, email: true },
            });
            if (!users.length) return;

            await this.prisma.notification.createMany({
                data: users.map((u) => ({
                    userId: u.id,
                    type: payload.type,
                    title: payload.title,
                    body: payload.body,
                    data: (payload.data ?? undefined) as Prisma.InputJsonValue | undefined,
                })),
            });

            await Promise.all([
                this.sendPush(users.map((u) => u.id), payload),
                payload.email ? this.sendEmails(users.map((u) => u.email), payload) : undefined,
            ]);
        } catch (err) {
            this.logger.error(`Failed to dispatch "${payload.title}": ${(err as Error).message}`);
        }
    }

    async notifyEmployees(employeeIds: number[], payload: NotifyPayload): Promise<void> {
        try {
            if (!employeeIds.length) return;
            const employees = await this.prisma.employee.findMany({
                where: { id: { in: employeeIds }, deletedAt: null, recordStatus: 'active' },
                select: { userId: true },
            });
            await this.notifyUsers(employees.map((e) => e.userId), payload);
        } catch (err) {
            this.logger.error(`Failed to resolve employees for "${payload.title}": ${(err as Error).message}`);
        }
    }

    async notifyAdmins(payload: NotifyPayload): Promise<void> {
        try {
            const admins = await this.prisma.user.findMany({
                where: { role: 'admin', isActive: true, deletedAt: null },
                select: { id: true },
            });
            await this.notifyUsers(admins.map((a) => a.id), payload);
        } catch (err) {
            this.logger.error(`Failed to notify admins "${payload.title}": ${(err as Error).message}`);
        }
    }

    /** "First Last" for a user, used in admin-facing message text. Never throws. */
    async displayName(userId: number): Promise<string> {
        try {
            const u = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { firstName: true, lastName: true, email: true },
            });
            return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || 'An employee';
        } catch {
            return 'An employee';
        }
    }

    // ─── Inbox ────────────────────────────────────────────────────

    async list(userId: number, filter: NotificationFilterDto) {
        const { page = 1, limit = 10 } = filter;
        const where: Prisma.NotificationWhereInput = {
            userId,
            ...(filter.unreadOnly && { readAt: null }),
        };
        const [items, total] = await Promise.all([
            this.prisma.notification.findMany({
                where, skip: filter.skip, take: limit, orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where }),
        ]);
        return new PaginatedResponse(items, total, page, limit);
    }

    async unreadCount(userId: number) {
        const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
        return { count };
    }

    async markRead(userId: number, id: number) {
        const result = await this.prisma.notification.updateMany({
            where: { id, userId, readAt: null },
            data: { readAt: new Date() },
        });
        if (result.count === 0) {
            const exists = await this.prisma.notification.findFirst({ where: { id, userId } });
            if (!exists) throw new NotFoundException('Notification');
        }
        return this.unreadCount(userId);
    }

    async markAllRead(userId: number) {
        const result = await this.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
        return { updated: result.count };
    }

    async remove(userId: number, id: number) {
        const result = await this.prisma.notification.deleteMany({ where: { id, userId } });
        if (result.count === 0) throw new NotFoundException('Notification');
    }

    async clearAll(userId: number) {
        const result = await this.prisma.notification.deleteMany({ where: { userId } });
        return { deleted: result.count };
    }

    // ─── Push tokens ──────────────────────────────────────────────

    async registerPushToken(userId: number, dto: RegisterPushTokenDto) {
        if (!/^Expo(nent)?PushToken\[.+\]$/.test(dto.token)) {
            throw new BadRequestException('Invalid Expo push token');
        }
        // A token belongs to one user at a time (device may be handed to another account)
        await this.prisma.pushToken.upsert({
            where: { token: dto.token },
            create: { userId, token: dto.token, platform: dto.platform, deviceId: dto.deviceId },
            update: { userId, platform: dto.platform, deviceId: dto.deviceId, lastUsedAt: new Date() },
        });
    }

    async unregisterPushToken(userId: number, token: string) {
        await this.prisma.pushToken.deleteMany({ where: { userId, token } });
    }

    // ─── Admin broadcast ──────────────────────────────────────────

    async broadcast(dto: BroadcastDto) {
        if (dto.target !== BroadcastTarget.ALL && !dto.ids?.length) {
            throw new BadRequestException('ids are required for this target');
        }

        const where: Prisma.EmployeeWhereInput = {
            deletedAt: null, recordStatus: 'active', isActive: true,
            ...(dto.target === BroadcastTarget.DEPARTMENT && { departmentId: { in: dto.ids } }),
            ...(dto.target === BroadcastTarget.TEAM && { teamId: { in: dto.ids } }),
            ...(dto.target === BroadcastTarget.EMPLOYEES && { id: { in: dto.ids } }),
        };

        const employees = await this.prisma.employee.findMany({ where, select: { userId: true } });
        if (!employees.length) throw new BadRequestException('No active employees match this target');

        await this.notifyUsers(employees.map((e) => e.userId), {
            type: 'announcement',
            title: dto.title,
            body: dto.body,
            email: dto.sendEmail,
        });
        return { recipients: employees.length };
    }

    // ─── Channels ─────────────────────────────────────────────────

    private async sendPush(userIds: number[], payload: NotifyPayload) {
        const tokens = await this.prisma.pushToken.findMany({
            where: { userId: { in: userIds } },
            select: { token: true },
        });
        if (!tokens.length) return;

        const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');

        for (let i = 0; i < tokens.length; i += EXPO_CHUNK_SIZE) {
            const chunk = tokens.slice(i, i + EXPO_CHUNK_SIZE);
            const messages = chunk.map((t) => ({
                to: t.token,
                title: payload.title,
                body: payload.body,
                sound: 'default',
                data: { ...payload.data, type: payload.type },
            }));

            try {
                const res = await fetch(EXPO_PUSH_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
                    },
                    body: JSON.stringify(messages),
                });
                if (!res.ok) {
                    this.logger.warn(`Expo push responded ${res.status}`);
                    continue;
                }

                // Tickets come back in the same order as messages; drop tokens Expo says are dead
                const { data: tickets } = (await res.json()) as {
                    data: { status: string; message?: string; details?: { error?: string } }[];
                };
                tickets?.forEach((t) => {
                    if (t.status !== 'ok') {
                        this.logger.warn(`Expo push rejected: ${t.details?.error ?? 'error'} — ${t.message ?? ''}`);
                    }
                });
                const dead = chunk
                    .filter((_, idx) => tickets?.[idx]?.details?.error === 'DeviceNotRegistered')
                    .map((t) => t.token);
                if (dead.length) {
                    await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
                }
            } catch (err) {
                this.logger.warn(`Expo push failed: ${(err as Error).message}`);
            }
        }
    }

    private async sendEmails(emails: string[], payload: NotifyPayload) {
        const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
        const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h3>${esc(payload.title)}</h3><p>${esc(payload.body)}</p></div>`;
        const text = `${payload.title}\n\n${payload.body}`;
        await Promise.all(emails.map((to) => this.mail.send(to, payload.title, html, text)));
    }
}
