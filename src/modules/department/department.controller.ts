import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto, DepartmentFilterDto, UpdateDepartmentDto } from './dto/department.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Post()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Create department (Admin)' })
    async create(@Body() dto: CreateDepartmentDto, @CurrentUser('id') adminId: number) {
        const result = await this.departmentService.create(dto, adminId);
        return ApiResponse.created(result, 'Department created');
    }

    @Get()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'List departments with pagination (Admin)' })
    async findAll(@Query() filter: DepartmentFilterDto) {
        return this.departmentService.findAll(filter);
    }

    @Get('active')
    @ApiOperation({ summary: 'List all active departments (dropdown use)' })
    async findAllActive() {
        return ApiResponse.ok(await this.departmentService.findAllActive());
    }

    @Get(':id')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Get department by ID (Admin)' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.departmentService.findById(id));
    }

    @Patch(':id')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Update department (Admin)' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateDepartmentDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.departmentService.update(id, dto, adminId), 'Department updated');
    }

    @Delete(':id')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete department (Admin)' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        await this.departmentService.remove(id, adminId);
        return ApiResponse.ok(null, 'Department deleted');
    }
}
