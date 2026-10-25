import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateHolidayDto {
    @ApiProperty({ example: 'Eid ul-Fitr' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: '2026-04-01', description: 'Holiday start date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-04-03', description: 'Holiday end date (YYYY-MM-DD), same as startDate for single-day' })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: 'National public holiday' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ type: [Number], example: [3, 5], description: 'Employee IDs to exclude from this holiday' })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    @Type(() => Number)
    excludeEmployeeIds?: number[];

    @ApiPropertyOptional({ type: [Number], example: [2], description: 'Team IDs to exclude from this holiday' })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    @Type(() => Number)
    excludeTeamIds?: number[];
}

export class UpdateHolidayDto {
    @ApiPropertyOptional({ example: 'Eid ul-Fitr (Revised)' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: '2026-04-01' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-04-03' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ type: [Number], description: 'Replace exclusion list for employees (replaces existing)' })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    @Type(() => Number)
    excludeEmployeeIds?: number[];

    @ApiPropertyOptional({ type: [Number], description: 'Replace exclusion list for teams (replaces existing)' })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @IsPositive({ each: true })
    @Type(() => Number)
    excludeTeamIds?: number[];
}

export class HolidayFilterDto extends PaginationDto {
    @ApiPropertyOptional({ example: 2026, description: 'Filter by year' })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    year?: number;
}
