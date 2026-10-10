import { Module } from '@nestjs/common';
import { OfficeLocationService } from './office-location.service';
import { OfficeLocationRepository } from './office-location.repository';

@Module({
    providers: [OfficeLocationService, OfficeLocationRepository],
    exports: [OfficeLocationRepository],
})
export class OfficeLocationModule { }
