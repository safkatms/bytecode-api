import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize, ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt, IsOptional,
} from 'class-validator';

export enum ReportRange {
    LAST_WEEK = 'last_week',
    THIS_MONTH = 'this_month',
    CUSTOM = 'custom',
}

export enum ReportScope {
    ALL = 'all',
    DEPARTMENT = 'department',
    TEAM = 'team',
    EMPLOYEES = 'employees',
}

export class EmailAttendanceReportDto {
    @ApiProperty({ enum: ReportRange, description: 'Weeks run Monday to Sunday' })
    @IsEnum(ReportRange)
    range: ReportRange;

    @ApiPropertyOptional({ example: '2026-10-01', description: 'Required when range = custom' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-10-31', description: 'Required when range = custom' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty({ enum: ReportScope })
    @IsEnum(ReportScope)
    scope: ReportScope;

    @ApiPropertyOptional({ description: 'Department / team / employee ids, depending on scope' })
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    ids?: number[];

    @ApiProperty({ description: 'User ids (from GET /users) the report is emailed to', type: [Number] })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(50)
    @IsInt({ each: true })
    recipientUserIds: number[];
}
