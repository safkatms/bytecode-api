import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { HolidayService } from './holiday.service';
import { CreateHolidayDto, HolidayFilterDto, UpdateHolidayDto } from './dto/holiday.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Holidays')
@ApiBearerAuth()
@Controller('holidays')
export class HolidayController {
    constructor(private readonly holidayService: HolidayService) { }

    @Post()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Create a holiday and auto-mark attendance for all applicable employees' })
    async create(@Body() dto: CreateHolidayDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.created(
            await this.holidayService.create(dto, adminId),
            'Holiday created',
        );
    }

    @Patch(':id')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update holiday details or exclusion lists' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateHolidayDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(
            await this.holidayService.update(id, dto, adminId),
            'Holiday updated',
        );
    }

    @Delete(':id')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a holiday and remove its attendance entries' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        return ApiResponse.ok(
            await this.holidayService.remove(id, adminId),
            'Holiday deleted',
        );
    }

    @Get()
    @Public()
    @ApiOperation({ summary: 'List holidays (optionally filter by year)' })
    async findAll(@Query() filter: HolidayFilterDto) {
        return this.holidayService.findAll(filter);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get holiday by ID with exclusion details' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.holidayService.findOne(id));
    }
}
