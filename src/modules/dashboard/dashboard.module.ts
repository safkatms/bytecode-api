import { Module } from '@nestjs/common';
import { DashboardAdminController } from './controllers/dashboard-admin.controller';
import { DashboardEmployeeController } from './controllers/dashboard-employee.controller';
import { DashboardService } from './dashboard.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
    imports: [AttendanceModule],          // gives us EmployeeService (already exported)
    controllers: [DashboardAdminController, DashboardEmployeeController],
    providers: [DashboardService],
})
export class DashboardModule { }