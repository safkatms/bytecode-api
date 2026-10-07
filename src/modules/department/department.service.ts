import { Injectable } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { CreateDepartmentDto, DepartmentFilterDto, UpdateDepartmentDto } from './dto/department.dto';
import { ConflictException, NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class DepartmentService {
    constructor(private readonly departmentRepo: DepartmentRepository) {}

    async create(dto: CreateDepartmentDto, adminId: number) {
        const existing = await this.departmentRepo.findByName(dto.name);
        if (existing) throw new ConflictException('A department with this name already exists');

        return this.departmentRepo.create({
            ...dto,
            createdBy: adminId,
            updatedBy: adminId,
        });
    }

    async findAll(filter: DepartmentFilterDto) {
        return this.departmentRepo.search(filter);
    }

    async findAllActive() {
        return this.departmentRepo.findAllActive();
    }

    async findById(id: number) {
        const dept = await this.departmentRepo.findById(id);
        if (!dept) throw new NotFoundException('Department');
        return dept;
    }

    async update(id: number, dto: UpdateDepartmentDto, adminId: number) {
        await this.findById(id);

        if (dto.name) {
            const existing = await this.departmentRepo.findByName(dto.name);
            if (existing && existing.id !== id) throw new ConflictException('Department name already in use');
        }

        return this.departmentRepo.update(id, { ...dto, updatedBy: adminId });
    }

    async remove(id: number, adminId: number) {
        await this.findById(id);
        await this.departmentRepo.update(id, {
            deletedAt: new Date(),
            deletedBy: adminId,
            recordStatus: 'deleted',
            updatedBy: adminId,
        });
    }
}
