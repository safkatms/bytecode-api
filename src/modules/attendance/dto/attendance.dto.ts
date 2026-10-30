import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsDateString, IsEnum, IsInt, IsISO8601, IsNotEmpty,
    IsNumber, IsOptional, IsString, Max, Min, IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ─── Employee Check-in / Check-out (from mobile app) ─────────

export class CheckInDto {
    @ApiProperty({ example: 23.8103, description: 'GPS latitude from device' })
    @IsNotEmpty()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @ApiProperty({ example: 90.4125, description: 'GPS longitude from device' })
    @IsNotEmpty()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;

    @ApiProperty({ example: '2026-10-10T09:05:00', description: 'Local check-in datetime from device (ISO 8601, stored exactly as sent)' })
    @IsNotEmpty()
    @IsString()
    checkInTime: string;

    // deviceId comes from request header X-Device-ID (not body — prevents spoofing)
}

export class CheckOutDto {
    @ApiProperty({ example: 23.8103 })
    @IsNotEmpty()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @ApiProperty({ example: 90.4125 })
    @IsNotEmpty()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;

    @ApiProperty({ example: '2026-10-10T18:00:00', description: 'Local check-out datetime from device (ISO 8601, stored exactly as sent)' })
    @IsNotEmpty()
    @IsString()
    checkOutTime: string;
}

// ─── Admin manual attendance ──────────────────────────────────

export class AdminMarkAttendanceDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    employeeId: number;

    @ApiProperty({ example: '2024-01-15' })
    @IsNotEmpty()
    @IsDateString()
    attendanceDate: string;

    @ApiProperty({ enum: AttendanceStatus })
    @IsNotEmpty()
    @IsEnum(AttendanceStatus)
    status: AttendanceStatus;

    @ApiPropertyOptional({ example: '2024-01-15T09:05:00' })
    @IsOptional()
    @IsString()
    checkInTime?: string;

    @ApiPropertyOptional({ example: '2024-01-15T18:00:00' })
    @IsOptional()
    @IsString()
    checkOutTime?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(0)
    lateMinutes?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    note?: string;
}

export class AdminUpdateAttendanceDto extends PartialType(AdminMarkAttendanceDto) {}

// ─── Filters ──────────────────────────────────────────────────

export class AttendanceFilterDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    employeeId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    toDate?: string;

    @ApiPropertyOptional({ enum: AttendanceStatus })
    @IsOptional()
    @IsEnum(AttendanceStatus)
    status?: AttendanceStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    department?: string;
}

export class MonthlySummaryDto {
    @ApiProperty({ example: '2024-01', description: 'Format: YYYY-MM' })
    @IsNotEmpty()
    @IsString()
    month: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    employeeId?: number;
}

export class WeeklyTimesheetDto {
    @ApiPropertyOptional({ example: '2026-10-06', description: 'Any date in the target week (defaults to current week)' })
    @IsOptional()
    @IsDateString()
    date?: string;
}
