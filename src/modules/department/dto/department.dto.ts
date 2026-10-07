import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateDepartmentDto {
    @ApiProperty({ example: 'Engineering' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ example: 'Software engineering department' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class DepartmentFilterDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}
