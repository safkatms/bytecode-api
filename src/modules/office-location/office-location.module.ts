import { Module } from '@nestjs/common';
import { OfficeLocationController } from './office-location.controller';
import { OfficeLocationService } from './office-location.service';
import { OfficeLocationRepository } from './office-location.repository';

@Module({
    controllers: [OfficeLocationController],
    providers: [OfficeLocationService, OfficeLocationRepository],
    exports: [OfficeLocationRepository],
})
export class OfficeLocationModule { }
