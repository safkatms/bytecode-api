import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

// Single source of truth for supported keys and their defaults.
const DEFAULTS = {
    officeReminderTime: '10:00',
} as const;

type SettingKey = keyof typeof DEFAULTS;

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) { }

    async getAll(): Promise<Record<SettingKey, string>> {
        const rows = await this.prisma.systemSetting.findMany({
            where: { key: { in: Object.keys(DEFAULTS) } },
        });
        const result: Record<string, string> = { ...DEFAULTS };
        for (const r of rows) result[r.key] = r.value;
        return result as Record<SettingKey, string>;
    }

    async update(dto: UpdateSettingsDto, adminId: number) {
        const entries = (Object.keys(DEFAULTS) as SettingKey[])
            .filter((k) => dto[k] !== undefined)
            .map((k) => [k, dto[k] as string] as const);

        await this.prisma.$transaction(
            entries.map(([key, value]) =>
                this.prisma.systemSetting.upsert({
                    where: { key },
                    create: { key, value, updatedBy: adminId },
                    update: { value, updatedBy: adminId },
                }),
            ),
        );
        return this.getAll();
    }
}
