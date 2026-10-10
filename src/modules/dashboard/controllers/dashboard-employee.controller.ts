import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from '../dashboard.service';
import { ApiResponse } from '../../../common/response/api-response';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { EmployeeService } from '@modules/employee/employee.service';

@ApiTags('My Dashboard')
@ApiBearerAuth()
@Controller('dashboard/me')
export class DashboardEmployeeController {
    constructor(
        private readonly dashboardService: DashboardService,
        private readonly employeeService: EmployeeService,
    ) { }

    @Get('overview')
    @ApiOperation({ summary: "Today's status + this month's summary for the logged-in employee" })
    async overview(@CurrentUser('id') userId: number) {
        const emp = await this.employeeService.findByUserId(userId);
        return ApiResponse.ok(await this.dashboardService.getEmployeeOverview(emp.id));
    }

    @Get('attendance-trend')
    @ApiOperation({ summary: 'My attendance trend for the last N weeks' })
    @ApiQuery({ name: 'weeks', required: false, example: 6 })
    async attendanceTrend(
        @CurrentUser('id') userId: number,
        @Query('weeks', new DefaultValuePipe(6), ParseIntPipe) weeks: number,
    ) {
        const emp = await this.employeeService.findByUserId(userId);
        return ApiResponse.ok(await this.dashboardService.getEmployeeWeeklyTrend(emp.id, weeks));
    }
}