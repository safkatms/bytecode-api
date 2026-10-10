import { Injectable } from '@nestjs/common';
import { OfficeLocation, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class OfficeLocationRepository extends BaseRepository<
    OfficeLocation,
    Prisma.OfficeLocationWhereInput,
    Prisma.OfficeLocationOrderByWithRelationInput
> {
    constructor(private readonly prisma: PrismaService) {
        super(prisma.officeLocation);
    }

    async findActive() {
        return this.prisma.officeLocation.findFirst({
            where: { isActive: true, deletedAt: null, recordStatus: 'active' },
        });
    }

    async findAllActive() {
        return this.prisma.officeLocation.findMany({
            where: { isActive: true, deletedAt: null, recordStatus: 'active' },
        });
    }
}
