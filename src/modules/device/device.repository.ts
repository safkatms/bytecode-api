import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DeviceRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByEmployeeAndDeviceId(employeeId: number, deviceId: string) {
        return this.prisma.trustedDevice.findFirst({
            where: { employeeId, deviceId },
        });
    }

    async register(employeeId: number, deviceId: string, deviceName: string | null, createdBy: number) {
        return this.prisma.trustedDevice.create({
            data: { employeeId, deviceId, deviceName, isActive: true, createdBy },
        });
    }

    async updateLastSeen(id: number) {
        return this.prisma.trustedDevice.update({
            where: { id },
            data: { lastSeenAt: new Date() },
        });
    }

    async revoke(id: number, revokedBy: number) {
        return this.prisma.trustedDevice.update({
            where: { id },
            data: { isActive: false, revokedAt: new Date(), revokedBy },
        });
    }

    async findByEmployee(employeeId: number) {
        return this.prisma.trustedDevice.findMany({
            where: { employeeId },
            orderBy: { lastSeenAt: 'desc' },
        });
    }

    async findById(id: number) {
        return this.prisma.trustedDevice.findUnique({ where: { id } });
    }
}
