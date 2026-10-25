import {
    Body, Controller, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CasualLeaveService } from './casual-leave.service';
import {
    AdminMarkCasualLeaveDto, CasualLeaveFilterDto,
    ReviewCasualLeaveDto, SetCasualLeavePolicyDto,
} from './dto/casual-leave.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Casual Leave - Admin')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin/casual-leave')
export class CasualLeaveAdminController {
    constructor(private readonly casualLeaveService: CasualLeaveService) { }

    @Post('mark')
    @ApiOperation({ summary: 'Directly mark a day as casual leave for an employee' })
    async markCasualLeave(@Body() dto: AdminMarkCasualLeaveDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.created(
            await this.casualLeaveService.adminMarkCasualLeave(dto, adminId),
            'Day marked as casual leave',
        );
    }

    @Post('policy')
    @ApiOperation({ summary: 'Set or update casual leave policy for a year' })
    async setPolicy(@Body() dto: SetCasualLeavePolicyDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.ok(await this.casualLeaveService.setPolicy(dto, adminId), 'Policy saved');
    }

    @Get('policy/:year')
    @ApiOperation({ summary: 'Get casual leave policy for a year' })
    async getPolicy(@Param('year', ParseIntPipe) year: number) {
        return ApiResponse.ok(await this.casualLeaveService.getPolicy(year));
    }

    @Get('balance/:employeeId')
    @ApiOperation({ summary: 'Get casual leave balance for an employee (includes carry-forward)' })
    async getBalance(
        @Param('employeeId', ParseIntPipe) employeeId: number,
        @Query('year') yearStr: string | undefined,
    ) {
        const year = yearStr ? parseInt(yearStr, 10) : undefined;
        return ApiResponse.ok(await this.casualLeaveService.getEmployeeBalance(employeeId, year));
    }

    @Get('requests')
    @ApiOperation({ summary: 'List all casual leave requests with filters' })
    async listRequests(@Query() filter: CasualLeaveFilterDto) {
        return this.casualLeaveService.listRequests(filter);
    }

    @Get('requests/:id')
    @ApiOperation({ summary: 'Get casual leave request by ID' })
    async getRequest(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.casualLeaveService.getRequestById(id));
    }

    @Patch('requests/:id/review')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Approve or reject a casual leave request' })
    async review(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ReviewCasualLeaveDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(
            await this.casualLeaveService.review(id, dto, adminId),
            dto.action === 'approved' ? 'Request approved' : 'Request rejected',
        );
    }
}
