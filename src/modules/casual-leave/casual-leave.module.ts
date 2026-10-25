import { Module } from '@nestjs/common';
import { CasualLeaveAdminController } from './casual-leave-admin.controller';
import { CasualLeaveEmployeeController } from './casual-leave-employee.controller';
import { CasualLeaveService } from './casual-leave.service';
import { CasualLeaveRepository } from './casual-leave.repository';

@Module({
    controllers: [CasualLeaveAdminController, CasualLeaveEmployeeController],
    providers: [CasualLeaveService, CasualLeaveRepository],
    exports: [CasualLeaveService],
})
export class CasualLeaveModule { }
