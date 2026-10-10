import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TeamService } from './team.service';
import { AddTeamMemberDto, CreateTeamDto, TeamFilterDto, UpdateTeamDto } from './dto/team.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamController {
    constructor(private readonly teamService: TeamService) { }

    @Post()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Create team (Admin)' })
    async create(@Body() dto: CreateTeamDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.created(await this.teamService.create(dto, adminId), 'Team created');
    }

    @Get()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'List teams with pagination (Admin)' })
    async findAll(@Query() filter: TeamFilterDto) {
        return this.teamService.findAll(filter);
    }

    @Get('active')
    @ApiOperation({ summary: 'List all active teams (dropdown use)' })
    async findAllActive() {
        return ApiResponse.ok(await this.teamService.findAllActive());
    }

    @Get(':id')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Get team by ID with leader and members (Admin)' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return ApiResponse.ok(await this.teamService.findById(id));
    }

    @Patch(':id')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Update team (Admin)' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateTeamDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.teamService.update(id, dto, adminId), 'Team updated');
    }

    @Post(':id/members')
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Add employee to team (Admin)' })
    async addMember(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AddTeamMemberDto,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.teamService.addMember(id, dto, adminId), 'Member added');
    }

    @Delete(':id/members/:employeeId')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove employee from team (Admin)' })
    async removeMember(
        @Param('id', ParseIntPipe) id: number,
        @Param('employeeId', ParseIntPipe) employeeId: number,
        @CurrentUser('id') adminId: number,
    ) {
        return ApiResponse.ok(await this.teamService.removeMember(id, employeeId, adminId), 'Member removed');
    }

    @Delete(':id')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete team (Admin)' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
        await this.teamService.remove(id, adminId);
        return ApiResponse.ok(null, 'Team deleted');
    }
}
