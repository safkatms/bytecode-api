import {
    Body, Controller, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasualLeaveService } from './casual-leave.service';
import { ApplyCasualLeaveDto, CasualLeaveFilterDto } from './dto/casual-leave.dto';
import { ApiResponse } from '../../common/response/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Casual Leave - Employee')
@ApiBearerAuth()
@Controller('casual-leave')
export class CasualLeaveEmployeeController {
    constructor(private readonly casualLeaveService: CasualLeaveService) { }

    @Post('apply')
    @ApiOperation({ summary: 'Apply for casual leave' })
    async apply(@Body() dto: ApplyCasualLeaveDto, @CurrentUser('id') userId: number) {
        return ApiResponse.created(
            await this.casualLeaveService.apply(userId, dto),
            'Casual leave request submitted',
        );
    }

    @Patch(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel own pending casual leave request' })
    async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
        return ApiResponse.ok(
            await this.casualLeaveService.cancelRequest(userId, id),
            'Request cancelled',
        );
    }

    @Get('my-requests')
    @ApiOperation({ summary: 'List own casual leave requests' })
    async myRequests(@Query() filter: CasualLeaveFilterDto, @CurrentUser('id') userId: number) {
        return this.casualLeaveService.getMyRequests(userId, filter);
    }

    @Get('my-balance')
    @ApiOperation({ summary: 'Get own casual leave balance for a year (includes carry-forward)' })
    async myBalance(@Query('year') yearStr: string | undefined, @CurrentUser('id') userId: number) {
        const year = yearStr ? parseInt(yearStr, 10) : undefined;
        return ApiResponse.ok(await this.casualLeaveService.getMyBalance(userId, year));
    }
}
