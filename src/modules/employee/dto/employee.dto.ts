import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
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

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    departmentId?: number;

    @ApiPropertyOptional({ example: 'Software Engineer' })
    @IsOptional()
    @IsString()
    designation?: string;

    @ApiProperty({ example: '2024-01-01' })
    @IsNotEmpty()
    @IsDateString()
    joiningDate: string;

    @ApiPropertyOptional({
        example: [5, 6],
        description: 'Weekend day numbers (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat). Defaults to [5,6].',
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(7)
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(6, { each: true })
    weekendDays?: number[];

    // ── Personal details ─────────────────────────────────────────
    @ApiPropertyOptional({ example: 'Abdul Doe' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    fatherName?: string;

    @ApiPropertyOptional({ example: '1995-05-20' })
    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @ApiPropertyOptional({ example: 'O+' })
    @IsOptional()
    @IsString()
    @MaxLength(5)
    bloodGroup?: string;

    @ApiPropertyOptional({ example: 'john@bytecode.com', description: 'ByteCode/DiziCashier email' })
    @IsOptional()
    @IsEmail()
    officeEmail?: string;

    @ApiPropertyOptional({ example: '+8801800000000' })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    emergencyContactNo?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    presentAddress?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    permanentAddress?: string;

    @ApiPropertyOptional({ example: '1234567890' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    primeBankAccountNo?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class EmployeeFilterDto extends PaginationDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    departmentId?: number;
}
