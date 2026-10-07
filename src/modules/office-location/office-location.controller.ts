import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OfficeLocationService } from './office-location.service';
import { CreateOfficeLocationDto, UpdateOfficeLocationDto } from './dto/office-location.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Office Locations')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('office-locations')
export class OfficeLocationController {
    constructor(private readonly service: OfficeLocationService) { }

    @Post()
    @ApiOperation({ summary: 'Add office location with geofence (Admin)' })
    async create(@Body() dto: CreateOfficeLocationDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.created(await this.service.create(dto, adminId), 'Office location added');
    }

    @Get()
    @ApiOperation({ summary: 'List all active office locations (Admin)' })
    async findAll() {
        return ApiResponse.ok(await this.service.findAll());
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get office location by ID (Admin)' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.service.findById(id));
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update office location / radius (Admin)' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateOfficeLocationDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.service.update(id, dto, adminId), 'Office location updated');
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove office location (Admin)' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        await this.service.remove(id, adminId);
        return ApiResponse.ok(null, 'Office location removed');
    }
}
