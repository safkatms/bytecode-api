import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateEmployeeDto {
    // ── User account fields ──────────────────────────────────────
    @ApiProperty({ example: 'John' })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiProperty({ example: 'john@company.com' })
    @IsNotEmpty()
    @IsString()
    email: string;

    @ApiPropertyOptional({ example: '+8801700000000' })
    @IsOptional()
    @IsString()
    phone?: string;

    // ── Employee profile fields ──────────────────────────────────
    @ApiProperty({ example: 'EMP-001' })
    @IsNotEmpty()
    @IsString()
    employeeCode: string;

    @ApiPropertyOptional({ example: 'Engineering' })
    @IsOptional()
    @IsString()
    department?: string;

    @ApiPropertyOptional({ example: 'Software Engineer' })
    @IsOptional()
    @IsString()
    designation?: string;

    @ApiProperty({ example: '2024-01-01' })
    @IsNotEmpty()
    @IsDateString()
    joiningDate: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class EmployeeFilterDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    department?: string;
}
