import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateOfficeLocationDto {
    @ApiProperty({ example: 'Head Office' })
    @IsNotEmpty()
    @IsString()
    name: string;

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

    @ApiProperty({ example: 100, description: 'Allowed radius in meters' })
    @IsNotEmpty()
    @IsInt()
    @Min(10)
    @Max(5000)
    radiusMeters: number;
}

