import { Injectable } from '@nestjs/common';
import { OfficeLocationRepository } from './office-location.repository';
import { CreateOfficeLocationDto, UpdateOfficeLocationDto } from './dto/office-location.dto';
import { NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class OfficeLocationService {
    constructor(private readonly repo: OfficeLocationRepository) { }

    async create(dto: CreateOfficeLocationDto, adminId: number) {
        return this.repo.create({ ...dto, createdBy: adminId, updatedBy: adminId });
    }

    async findAll() {
        return this.repo.findAllActive();
    }

    async findById(id: number) {
        const loc = await this.repo.findById(id);
        if (!loc) throw new NotFoundException('Office location');
        return loc;
    }

    async update(id: number, dto: UpdateOfficeLocationDto, adminId: number) {
        await this.findById(id);
        return this.repo.update(id, { ...dto, updatedBy: adminId });
    }

    async remove(id: number, adminId: number) {
        await this.findById(id);
        await this.repo.update(id, { deletedAt: new Date(), deletedBy: adminId, recordStatus: 'deleted', updatedBy: adminId });
    }
}
