import { Module } from '@nestjs/common';
import { HolidayController } from './holiday.controller';
import { HolidayService } from './holiday.service';
import { HolidayRepository } from './holiday.repository';

@Module({
    controllers: [HolidayController],
    providers: [HolidayService, HolidayRepository],
    exports: [HolidayService],
})
export class HolidayModule { }
