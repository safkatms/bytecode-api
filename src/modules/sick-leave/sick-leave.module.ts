import { Module } from '@nestjs/common';
import { SickLeaveAdminController } from './sick-leave-admin.controller';
import { SickLeaveEmployeeController } from './sick-leave-employee.controller';
import { SickLeaveService } from './sick-leave.service';
import { SickLeaveRepository } from './sick-leave.repository';

@Module({
    controllers: [SickLeaveAdminController, SickLeaveEmployeeController],
    providers: [SickLeaveService, SickLeaveRepository],
    exports: [SickLeaveService],
})
export class SickLeaveModule { }
