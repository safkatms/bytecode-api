import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty,
    IsOptional, IsString, MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class NotificationFilterDto extends PaginationDto {
    @ApiPropertyOptional({ description: 'Only unread notifications' })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    unreadOnly?: boolean;
}

export class RegisterPushTokenDto {
    @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    token: string;

    @ApiPropertyOptional({ example: 'android' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    platform?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(255)
    deviceId?: string;
}

export class UnregisterPushTokenDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    token: string;
}

export enum BroadcastTarget {
    ALL = 'all',
    DEPARTMENT = 'department',
    TEAM = 'team',
    EMPLOYEES = 'employees',
}

export class BroadcastDto {
    @ApiProperty({ example: 'Office closed tomorrow' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    body: string;

    @ApiProperty({ enum: BroadcastTarget })
    @IsEnum(BroadcastTarget)
    target: BroadcastTarget;

    @ApiPropertyOptional({ description: 'Department / team / employee ids, depending on target' })
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    ids?: number[];

    @ApiPropertyOptional({ description: 'Also send by email', default: false })
    @IsOptional()
    @IsBoolean()
    sendEmail?: boolean;
}
