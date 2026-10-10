import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateTeamDto {
    @ApiProperty({ example: 'Backend Team' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ example: 'Handles all backend services' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @ApiProperty({ example: 1, description: 'Employee ID of the team leader' })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    leaderId: number;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class AddTeamMemberDto {
    @ApiProperty({ example: 2, description: 'Employee ID to add to the team' })
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    employeeId: number;
}

export class TeamFilterDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}
