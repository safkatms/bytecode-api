import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DashboardService } from '../dashboard.service';
import { ApiResponse } from '../../../common/response/api-response';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Admin — Dashboard')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin/dashboard')
export class DashboardAdminController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('overview')
    @ApiOperation({ summary: 'KPI cards — employee counts + today attendance breakdown' })
    async overview() {
        return ApiResponse.ok(await this.dashboardService.getAdminOverview());
    }

    @Get('attendance-trend')
    @ApiOperation({ summary: 'Monthly attendance trend for the last N months' })
    @ApiQuery({ name: 'months', required: false, example: 6 })
    async attendanceTrend(@Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number) {
        return ApiResponse.ok(await this.dashboardService.getAdminAttendanceTrend(months));
    }

    @Get('department-breakdown')
    @ApiOperation({ summary: "Today's attendance broken down by department" })
    async departmentBreakdown() {
        return ApiResponse.ok(await this.dashboardService.getAdminDepartmentBreakdown());
    }

    @Get('recent-activity')
    @ApiOperation({ summary: 'Last N attendance events (check-ins, updates)' })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async recentActivity(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
        return ApiResponse.ok(await this.dashboardService.getAdminRecentActivity(limit));
    }

    @Get('late-report')
    @ApiOperation({ summary: 'Late arrivals grouped by employee for a given month' })
    @ApiQuery({ name: 'month', required: false, example: '2024-01' })
    async lateReport(@Query('month') month?: string) {
        return ApiResponse.ok(await this.dashboardService.getAdminLateReport(month));
    }
}