import {
    Body, Controller, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SickLeaveService } from './sick-leave.service';
import { ApplySickLeaveDto, SickLeaveFilterDto } from './dto/sick-leave.dto';
import { ApiResponse } from '../../common/response/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Sick Leave - Employee')
@ApiBearerAuth()
@Controller('sick-leave')
export class SickLeaveEmployeeController {
    constructor(private readonly sickLeaveService: SickLeaveService) { }

    @Post('apply')
    @ApiOperation({ summary: 'Apply for sick leave' })
    async apply(@Body() dto: ApplySickLeaveDto, @CurrentUser('id') userId: number) {
        return ApiResponse.created(
            await this.sickLeaveService.apply(userId, dto),
            'Sick leave request submitted',
        );
    }

    @Patch(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel own pending sick leave request' })
    async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
        return ApiResponse.ok(
            await this.sickLeaveService.cancelRequest(userId, id),
            'Request cancelled',
        );
    }

    @Get('my-requests')
    @ApiOperation({ summary: 'List own sick leave requests' })
    async myRequests(@Query() filter: SickLeaveFilterDto, @CurrentUser('id') userId: number) {
        return this.sickLeaveService.getMyRequests(userId, filter);
    }

    @Get('my-balance')
    @ApiOperation({ summary: 'Get own sick leave balance for a year' })
    async myBalance(@Query('year') yearStr: string | undefined, @CurrentUser('id') userId: number) {
        const year = yearStr ? parseInt(yearStr, 10) : undefined;
        return ApiResponse.ok(await this.sickLeaveService.getMyBalance(userId, year));
    }
}
