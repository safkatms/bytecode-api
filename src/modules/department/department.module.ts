import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';

@Module({
    controllers: [DepartmentController],
    providers: [DepartmentService, DepartmentRepository],
    exports: [DepartmentService, DepartmentRepository],
})
export class DepartmentModule {}
