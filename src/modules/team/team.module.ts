import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamRepository } from './team.repository';

@Module({
    controllers: [TeamController],
    providers: [TeamService, TeamRepository],
    exports: [TeamService, TeamRepository],
})
export class TeamModule { }
