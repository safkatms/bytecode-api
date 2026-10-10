import { Injectable } from '@nestjs/common';
import { OfficeLocationRepository } from './office-location.repository';
import { CreateOfficeLocationDto } from './dto/office-location.dto';

@Injectable()
export class OfficeLocationService {
    constructor(private readonly repo: OfficeLocationRepository) { }

    async get() {
        return this.repo.findActive();
    }

    async upsert(dto: CreateOfficeLocationDto, adminId: number) {
        const existing = await this.repo.findActive();
        if (existing) {
            return this.repo.update(existing.id, { ...dto, updatedBy: adminId });
        }
        return this.repo.create({ ...dto, createdBy: adminId, updatedBy: adminId });
    }
}
