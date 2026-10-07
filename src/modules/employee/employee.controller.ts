import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { EmployeeService } from './employee.service';
import { DeviceService } from '../device/device.service';
import { CreateEmployeeDto, EmployeeFilterDto, UpdateEmployeeDto } from './dto/employee.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeeController {
    constructor(
        private readonly employeeService: EmployeeService,
        private readonly deviceService: DeviceService,
    ) { }

    @Post()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Create user account + employee profile in one step (Admin)' })
    async create(@Body() dto: CreateEmployeeDto, @CurrentUser('id') adminId: number) {
        const result = await this.employeeService.create(dto, adminId);
        return ApiResponse.created(result, 'Employee account created — share the temporary password securely');
    }

    @Get()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'List employees (Admin)' })
    async findAll(@Query() filter: EmployeeFilterDto) {
        return this.employeeService.findAll(filter);
    }

    @Get(':id')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Get employee by ID (Admin)' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.employeeService.findById(id));
    }

    @Patch(':id')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Update employee (Admin)' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateEmployeeDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.employeeService.update(id, dto, adminId), 'Employee updated');
    }

    @Patch(':id/toggle-active')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Activate / Deactivate employee (Admin)' })
    async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        const emp = await this.employeeService.toggleActive(id, adminId);
        return ApiResponse.ok(emp, `Employee ${emp.isActive ? 'activated' : 'deactivated'}`);
    }

    @Delete(':id')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete employee (Admin)' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        await this.employeeService.remove(id, adminId);
        return ApiResponse.ok(null, 'Employee deleted');
    }

    // ─── Device Management ────────────────────────────────────────

    @Get(':id/devices')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'List registered devices for an employee (Admin)' })
    async getDevices(@Param('id', ParseIntPipe) id: number) {
        await this.employeeService.findById(id); // ensure exists
        return ApiResponse.ok(await this.deviceService.getDevicesForEmployee(id));
    }

    @Delete('devices/:deviceId')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke a trusted device (Admin)' })
    async revokeDevice(@Param('deviceId', ParseIntPipe) deviceId: number, @CurrentUser('id') adminId: number) {
        return ApiResponse.ok(await this.deviceService.revokeDevice(deviceId, adminId), 'Device revoked');
    }
}
