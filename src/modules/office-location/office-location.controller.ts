import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OfficeLocationService } from './office-location.service';
import { CreateOfficeLocationDto } from './dto/office-location.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Office Location')
@ApiBearerAuth()
@Controller('attendance/office-location')
export class OfficeLocationController {
    constructor(private readonly service: OfficeLocationService) { }

    @Get()
    @ApiOperation({ summary: 'Get the office location (All users)' })
    async get() {
        return ApiResponse.ok(await this.service.get());
    }

    @Put()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Save / update the office location (Admin)' })
    async upsert(@Body() dto: CreateOfficeLocationDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.ok(await this.service.upsert(dto, adminId), 'Office location saved');
    }
}
