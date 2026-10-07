import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'device-uuid-abc123', description: 'Required for employee logins' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'Samsung Galaxy S24' })
  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class TokenResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty() expiresIn: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsNotEmpty() @IsString() token: string;

  @ApiProperty({ minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsNotEmpty() @IsString() currentPassword: string;

  @ApiProperty({ minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}

export class SwitchUserDto {
  @ApiProperty({ example: 42 })
  @IsNotEmpty()
  userId: number;
}