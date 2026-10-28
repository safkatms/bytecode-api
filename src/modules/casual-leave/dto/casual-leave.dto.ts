import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength, Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ApplyCasualLeaveDto {
    @ApiProperty({ example: '2026-10-15', description: 'Start date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-10-16', description: 'End date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: 'Personal work' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export class ReviewCasualLeaveDto {
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

export class SetCasualLeavePolicyDto {
    @ApiProperty({ example: 2026 })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    year: number;

    @ApiProperty({ example: 12, description: 'Total casual leave days allocated for the year' })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    totalDays: number;

    @ApiProperty({ example: 5, description: 'Maximum days that can carry forward to next year' })
    @IsInt()
    @Min(0)
    @Type(() => Number)
    maxCarryForward: number;
}

export class CasualLeaveBalanceFilterDto extends PaginationDto {
    @ApiPropertyOptional({ example: 2026, description: 'Defaults to the current year' })
    @IsOptional()
    @IsInt()
    @Min(2000)
    @Type(() => Number)
    year?: number;
}

export class BackfillEarnedLeaveDto {
    @ApiProperty({ example: 2026 })
    @IsInt()
    @Min(2000)
    @Type(() => Number)
    year: number;
}

export class AdjustCasualLeaveBalanceDto {
    @ApiProperty({ example: 2026 })
    @IsInt()
    @Min(2000)
    @Type(() => Number)
    year: number;

    @ApiPropertyOptional({
        example: 4,
        description: 'Total casual days already used in this year (overwrites current usedDays)',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    usedDays?: number;

    @ApiPropertyOptional({ example: 2, description: 'Carry-forward days from the previous year' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    carryForwardDays?: number;
}

export class AdminMarkCasualLeaveDto {
    @ApiProperty({ example: 1, description: 'Employee ID' })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    employeeId: number;

    @ApiProperty({ example: '2026-10-15', description: 'Date to mark as casual leave (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    date: string;

    @ApiPropertyOptional({ example: 'Approved via phone' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class CasualLeaveFilterDto extends PaginationDto {
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
