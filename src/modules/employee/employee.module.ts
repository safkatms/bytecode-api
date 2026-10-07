import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { DeviceModule } from '../device/device.module';
import { UserModule } from '@modules/user/user.module';
import { DepartmentModule } from '../department/department.module';

@Module({
    imports: [UserModule, DeviceModule, DepartmentModule],
    controllers: [EmployeeController],
    providers: [EmployeeService, EmployeeRepository],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule { }
