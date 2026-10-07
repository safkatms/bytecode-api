import { Module } from '@nestjs/common';
import { AttendanceAdminController } from './attendance-admin.controller';
import { AttendanceEmployeeController } from './attendance-employee.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { EmployeeModule } from '../employee/employee.module';
import { DeviceModule } from '../device/device.module';
import { OfficeLocationModule } from '../office-location/office-location.module';
import { GeoGuard } from '../../common/guards/geo.guard';

@Module({
    imports: [EmployeeModule, DeviceModule, OfficeLocationModule],
    controllers: [AttendanceAdminController, AttendanceEmployeeController],
    providers: [AttendanceService, AttendanceRepository, GeoGuard],
    exports: [AttendanceService],
})
export class AttendanceModule { }
