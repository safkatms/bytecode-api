import { Injectable } from '@nestjs/common';
import { DeviceRepository } from './device.repository';
import { ConflictException, ForbiddenException, NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class DeviceService {
    constructor(private readonly deviceRepo: DeviceRepository) { }

    /**
     * Single-device policy:
     * - Unknown device + no active device on record → auto-register (first login).
     * - Unknown device + another active device exists → reject until admin revokes it.
     * - Known device, revoked → reject.
     * - Known device, active → update lastSeenAt.
     */
    async validateAndRegister(employeeId: number, deviceId: string, deviceName: string | null): Promise<void> {
        const existing = await this.deviceRepo.findByEmployeeAndDeviceId(employeeId, deviceId);

        if (!existing) {
            const activeDevice = await this.deviceRepo.findActiveByEmployee(employeeId);
            if (activeDevice) {
                throw new ConflictException(
                    'Login from this device is not allowed. Ask your admin to revoke the current device first.',
                );
            }
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
        if (!device.isActive) throw new ConflictException('Device is already revoked');
        return this.deviceRepo.revoke(device.id, adminId);
    }

    async unrevokeDevice(deviceId: number) {
        const device = await this.deviceRepo.findById(deviceId);
        if (!device) throw new NotFoundException('Device');
        if (device.isActive) throw new ConflictException('Device is already active');

        // single-device policy: block if another active device exists for the same employee
        const activeDevice = await this.deviceRepo.findActiveByEmployee(device.employeeId);
        if (activeDevice) {
            throw new ConflictException(
                'Another device is already active for this employee. Revoke it first.',
            );
        }

        return this.deviceRepo.unrevoke(device.id);
    }
}
