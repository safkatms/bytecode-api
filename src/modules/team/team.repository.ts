import { Injectable } from '@nestjs/common';
import { Prisma, Team } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { PaginatedResponse } from '../../common/response/paginated-response';
import { TeamFilterDto } from './dto/team.dto';

@Injectable()
export class TeamRepository extends BaseRepository<
    Team,
    Prisma.TeamWhereInput,
    Prisma.TeamOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.team);
    }

    private get active(): Prisma.TeamWhereInput {
        return { deletedAt: null, recordStatus: 'active' };
    }

    private get includeRelations() {
        return {
            leader: {
                select: {
                    id: true, employeeCode: true, designation: true,
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            },
            members: {
                where: { deletedAt: null, recordStatus: 'active' },
                select: {
                    id: true, employeeCode: true, designation: true,
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            },
        } as const;
    }

    async findById(id: number) {
        return this.prisma.team.findFirst({
            where: { id, ...this.active },
            include: this.includeRelations,
        });
    }

    async findByName(name: string) {
        return this.prisma.team.findFirst({ where: { name, ...this.active } });
    }

    async search(filter: TeamFilterDto): Promise<PaginatedResponse<any>> {
        const { page = 1, limit = 10, skip, search, sortBy = 'createdAt', order = 'DESC' } = filter;

        const where: Prisma.TeamWhereInput = {
            ...this.active,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.team.findMany({
                where, skip, take: limit,
                orderBy: { [sortBy]: order.toLowerCase() },
                include: this.includeRelations,
            }),
            this.prisma.team.count({ where }),
        ]);

        return new PaginatedResponse(data, total, page, limit);
    }

    async findAllActive() {
        return this.prisma.team.findMany({
            where: { ...this.active, isActive: true },
            orderBy: { name: 'asc' },
            include: {
                leader: {
                    select: {
                        id: true, employeeCode: true,
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        });
    }
}
