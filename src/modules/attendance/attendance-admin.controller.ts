import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import {
    AdminMarkAttendanceDto, AdminUpdateAttendanceDto,
    AttendanceFilterDto, MonthlySummaryDto,
    WeeklyTimesheetDto,
} from './dto/attendance.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin — Attendance')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin/attendance')
export class AttendanceAdminController {
    constructor(private readonly attendanceService: AttendanceService) { }

    @Post()
    @ApiOperation({ summary: 'Manually mark attendance for any employee' })
    async mark(@Body() dto: AdminMarkAttendanceDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.created(await this.attendanceService.adminMark(dto, adminId), 'Attendance marked');
    }

    @Get()
    @ApiOperation({ summary: 'List attendance with filters (employee, date range, status, department)' })
    async findAll(@Query() filter: AttendanceFilterDto) {
        return this.attendanceService.adminFindMany(filter);
    }

    @Get('summary/daily')
    @ApiOperation({ summary: 'Count of each status for a given date' })
    @ApiQuery({ name: 'date', example: '2024-01-15' })
    async dailySummary(@Query('date') date: string) {
        return ApiResponse.ok(await this.attendanceService.adminGetDailySummary(date));
    }

    @Get('summary/monthly')
    @ApiOperation({ summary: 'Monthly summary — all employees or specific employee' })
    async monthlySummary(@Query() dto: MonthlySummaryDto) {
        return ApiResponse.ok(await this.attendanceService.adminGetMonthlySummary(dto));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get single attendance record' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.attendanceService.adminFindById(id));
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Correct / update an attendance record' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AdminUpdateAttendanceDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.attendanceService.adminUpdate(id, dto, adminId), 'Attendance updated');
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete attendance record' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        await this.attendanceService.adminRemove(id, adminId);
        return ApiResponse.ok(null, 'Record deleted');
    }
    @Get('/timesheet/weekly/:employeeId')
    @ApiOperation({ summary: "Weekly timesheet for any employee (Admin)" })
    async employeeWeeklyTimesheet(
        @Param('employeeId', ParseIntPipe) employeeId: number,
        @Query() dto: WeeklyTimesheetDto,
    ) {
        return ApiResponse.ok(await this.attendanceService.adminGetWeeklyTimesheet(employeeId, dto));
    }
}
