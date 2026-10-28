import {
    Body, Controller, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SickLeaveService } from './sick-leave.service';
import { AdjustSickLeaveBalanceDto, AdminMarkSickLeaveDto, ReviewSickLeaveDto, SetSickLeavePolicyDto, SickLeaveBalanceFilterDto, SickLeaveFilterDto } from './dto/sick-leave.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Sick Leave - Admin')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin/sick-leave')
export class SickLeaveAdminController {
    constructor(private readonly sickLeaveService: SickLeaveService) { }

    @Post('mark')
    @ApiOperation({ summary: 'Directly mark a day as sick leave for an employee' })
    async markSickLeave(@Body() dto: AdminMarkSickLeaveDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.created(
            await this.sickLeaveService.adminMarkSickLeave(dto, adminId),
            'Day marked as sick leave',
        );
    }

    @Post('policy')
    @ApiOperation({ summary: 'Set or update sick leave policy for a year' })
    async setPolicy(@Body() dto: SetSickLeavePolicyDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.ok(await this.sickLeaveService.setPolicy(dto, adminId), 'Policy saved');
    }

    @Get('policy/:year')
    @ApiOperation({ summary: 'Get sick leave policy for a year' })
    async getPolicy(@Param('year', ParseIntPipe) year: number) {
        return ApiResponse.ok(await this.sickLeaveService.getPolicy(year));
    }

    @Get('balances')
    @ApiOperation({ summary: 'List sick leave balances of all active employees (paginated, searchable)' })
    async listBalances(@Query() filter: SickLeaveBalanceFilterDto) {
        return this.sickLeaveService.listBalances(filter);
    }

    @Get('balance/:employeeId')
    @ApiOperation({ summary: 'Get sick leave balance for an employee' })
    async getBalance(
        @Param('employeeId', ParseIntPipe) employeeId: number,
        @Query('year') yearStr: string | undefined,
    ) {
        const year = yearStr ? parseInt(yearStr, 10) : undefined;
        return ApiResponse.ok(await this.sickLeaveService.getEmployeeBalance(employeeId, year));
    }

    @Patch('balance/:employeeId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Set already-used days (opening balance for mid-year go-live)' })
    async adjustBalance(
        @Param('employeeId', ParseIntPipe) employeeId: number,
        @Body() dto: AdjustSickLeaveBalanceDto,
    ) {
        return ApiResponse.ok(
            await this.sickLeaveService.adjustBalance(employeeId, dto),
            'Balance updated',
        );
    }

    @Get('requests')
    @ApiOperation({ summary: 'List all sick leave requests with filters' })
    async listRequests(@Query() filter: SickLeaveFilterDto) {
        return this.sickLeaveService.listRequests(filter);
    }

    @Get('requests/:id')
    @ApiOperation({ summary: 'Get sick leave request by ID' })
    async getRequest(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.sickLeaveService.getRequestById(id));
    }

    @Patch('requests/:id/review')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Approve or reject a sick leave request' })
    async review(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ReviewSickLeaveDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(
            await this.sickLeaveService.review(id, dto, adminId),
            dto.action === 'approved' ? 'Request approved' : 'Request rejected',
        );
    }
}
