import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
    @ApiPropertyOptional({ example: '10:00', description: 'Office arrival reminder time, 24h HH:mm (BD wall-clock)' })
    @IsOptional()
    @Matches(TIME_REGEX, { message: 'officeReminderTime must be HH:mm (24h)' })
    officeReminderTime?: string;
}
