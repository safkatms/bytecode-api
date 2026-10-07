import { Injectable } from '@nestjs/common';
import { DeviceRepository } from './device.repository';
import { ForbiddenException, NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class DeviceService {
    constructor(private readonly deviceRepo: DeviceRepository) { }

    /**
     * Validates the device for an employee.
     * - If device has never been seen: auto-registers it (first-use policy).
     * - If device is known but revoked: throws.
     * - If device is active: updates lastSeenAt.
     */
    async validateAndRegister(employeeId: number, deviceId: string, deviceName: string | null): Promise<void> {
        const existing = await this.deviceRepo.findByEmployeeAndDeviceId(employeeId, deviceId);

        if (!existing) {
            // First time this device — auto-register
            await this.deviceRepo.register(employeeId, deviceId, deviceName, employeeId);
            return;
        }

        if (!existing.isActive) {
            throw new ForbiddenException('This device has been revoked. Contact admin.');
        }

        await this.deviceRepo.updateLastSeen(existing.id);
    }

    async getDevicesForEmployee(employeeId: number) {
        return this.deviceRepo.findByEmployee(employeeId);
    }

    async revokeDevice(deviceId: number, adminId: number) {
        const device = await this.deviceRepo.findById(deviceId);
        if (!device) throw new NotFoundException('Device');
        return this.deviceRepo.revoke(device.id, adminId);
    }
}
