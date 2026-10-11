import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ApplySickLeaveDto {
    @ApiProperty({ example: '2026-10-15', description: 'Start date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-10-16', description: 'End date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: 'Fever and cold' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export class ReviewSickLeaveDto {
    @ApiProperty({ enum: ['approved', 'rejected'] })
    @IsNotEmpty()
    @IsString()
    action: 'approved' | 'rejected';

    @ApiPropertyOptional({ example: 'Approved as per policy' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reviewNote?: string;
}

export class SetSickLeavePolicyDto {
    @ApiProperty({ example: 2026 })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    year: number;

    @ApiProperty({ example: 14, description: 'Total sick leave days for the year' })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    totalDays: number;
}

export class AdminMarkSickLeaveDto {
    @ApiProperty({ example: 1, description: 'Employee ID' })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    employeeId: number;

    @ApiProperty({ example: '2026-10-15', description: 'Date to mark as sick leave (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    date: string;

    @ApiPropertyOptional({ example: 'Reported sick via phone' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class SickLeaveFilterDto extends PaginationDto {
    @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected', 'cancelled'] })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ example: 2026 })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    year?: number;

    @ApiPropertyOptional({ example: 1, description: 'Filter by employee ID (admin only)' })
    @IsOptional()
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    employeeId?: number;
}
