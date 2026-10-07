import { Body, Controller, Get, Post, Query, Headers, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceFilterDto, CheckInDto, CheckOutDto, MonthlySummaryDto } from './dto/attendance.dto';
import { ApiResponse } from '../../common/response/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BadRequestException } from '../../common/exceptions/app.exception';
import { GeoGuard } from '../../common/guards/geo.guard';

@ApiTags('My Attendance')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Device-ID', required: true, description: 'Unique device identifier from mobile app' })
@ApiHeader({ name: 'X-Device-Name', required: false, description: 'Human-readable device model name' })
@Controller('attendance/me')
export class AttendanceEmployeeController {
    constructor(private readonly attendanceService: AttendanceService) { }

    private extractMobileContext(headers: Record<string, string>) {
        const deviceId = headers['x-device-id'];
        if (!deviceId?.trim()) throw new BadRequestException('X-Device-ID header is required');
        return { deviceId: deviceId.trim(), deviceName: headers['x-device-name'] ?? null };
    }

    @Post('check-in')
    @UseGuards(GeoGuard)
    @ApiOperation({ summary: 'Employee check-in with GPS location (Mobile app)' })
    async checkIn(
        @Body() dto: CheckInDto,
        @CurrentUser('id') userId: number,
        @Headers() headers: Record<string, string>,
    ) {
        const mobile = this.extractMobileContext(headers);
        const record = await this.attendanceService.checkIn(userId, dto, mobile);
        return ApiResponse.ok(record, 'Checked in successfully');
    }

    @Post('check-out')
    @UseGuards(GeoGuard)
    @ApiOperation({ summary: 'Employee check-out with GPS location (Mobile app)' })
    async checkOut(
        @Body() dto: CheckOutDto,
        @CurrentUser('id') userId: number,
        @Headers() headers: Record<string, string>,
    ) {
        const mobile = this.extractMobileContext(headers);
        const record = await this.attendanceService.checkOut(userId, dto, mobile);
        return ApiResponse.ok(record, 'Checked out successfully');
    }

    @Get('today')
    @ApiOperation({ summary: "Today's check-in/out status" })
    async todayStatus(@CurrentUser('id') userId: number) {
        return ApiResponse.ok(await this.attendanceService.getTodayStatus(userId));
    }

    @Get('history')
    @ApiOperation({ summary: 'My attendance history with date range filter' })
    async history(@CurrentUser('id') userId: number, @Query() filter: AttendanceFilterDto) {
        return this.attendanceService.getMyAttendance(userId, filter);
    }

    @Get('summary')
    @ApiOperation({ summary: 'My monthly attendance summary' })
    async summary(@CurrentUser('id') userId: number, @Query() dto: MonthlySummaryDto) {
        return ApiResponse.ok(await this.attendanceService.getMyMonthlySummary(userId, dto));
    }
}
