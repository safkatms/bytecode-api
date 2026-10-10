import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TeamRepository } from './team.repository';
import { AddTeamMemberDto, CreateTeamDto, TeamFilterDto, UpdateTeamDto } from './dto/team.dto';
import { BadRequestException, ConflictException, NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class TeamService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly teamRepo: TeamRepository,
    ) { }

    async create(dto: CreateTeamDto, adminId: number) {
        const existing = await this.teamRepo.findByName(dto.name);
        if (existing) throw new ConflictException('A team with this name already exists');

        await this.assertEmployeeExists(dto.leaderId);

        return this.teamRepo.create({ ...dto, createdBy: adminId, updatedBy: adminId });
    }

    async findAll(filter: TeamFilterDto) {
        return this.teamRepo.search(filter);
    }

    async findAllActive() {
        return this.teamRepo.findAllActive();
    }

    async findById(id: number) {
        const team = await this.teamRepo.findById(id);
        if (!team) throw new NotFoundException('Team');
        return team;
    }

    async update(id: number, dto: UpdateTeamDto, adminId: number) {
        await this.findById(id);

        if (dto.name) {
            const existing = await this.teamRepo.findByName(dto.name);
            if (existing && existing.id !== id) throw new ConflictException('Team name already in use');
        }

        if (dto.leaderId) await this.assertEmployeeExists(dto.leaderId);

        return this.teamRepo.update(id, { ...dto, updatedBy: adminId });
    }

    async addMember(teamId: number, dto: AddTeamMemberDto, adminId: number) {
        await this.findById(teamId);
        const employee = await this.assertEmployeeExists(dto.employeeId);

        if ((employee as any).teamId === teamId) {
            throw new ConflictException('Employee is already a member of this team');
        }

        return this.prisma.employee.update({
            where: { id: dto.employeeId },
            data: { teamId, updatedBy: adminId },
            select: { id: true, employeeCode: true, teamId: true },
        });
    }

    async removeMember(teamId: number, employeeId: number, adminId: number) {
        await this.findById(teamId);
        const employee = await this.assertEmployeeExists(employeeId);

        if ((employee as any).teamId !== teamId) {
            throw new BadRequestException('Employee is not a member of this team');
        }

        // Prevent removing the leader without reassigning first
        const team = await this.teamRepo.findById(teamId);
        if (team!.leaderId === employeeId) {
            throw new BadRequestException('Cannot remove the team leader. Reassign the leader first.');
        }

        return this.prisma.employee.update({
            where: { id: employeeId },
            data: { teamId: null, updatedBy: adminId },
            select: { id: true, employeeCode: true, teamId: true },
        });
    }

    async remove(id: number, adminId: number) {
        await this.findById(id);
        await this.teamRepo.update(id, {
            deletedAt: new Date(),
            deletedBy: adminId,
            recordStatus: 'deleted',
            updatedBy: adminId,
        });
    }

    private async assertEmployeeExists(employeeId: number) {
        const emp = await this.prisma.employee.findFirst({
            where: { id: employeeId, deletedAt: null, recordStatus: 'active' },
        });
        if (!emp) throw new NotFoundException('Employee');
        return emp;
    }
}
