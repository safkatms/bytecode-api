import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, SwitchUserDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/response/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return ApiResponse.ok(result, 'Login successful');
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body('refreshToken') token: string) {
    const tokens = await this.authService.refreshToken(token);
    return ApiResponse.ok(tokens, 'Token refreshed');
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — invalidate refresh token' })
  async logout(@CurrentUser('id') userId: number) {
    await this.authService.logout(userId);
    return ApiResponse.ok(null, 'Logged out successfully');
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request a password reset token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return ApiResponse.ok(null, 'If that email exists, a reset token has been issued');
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Reset password using token from forgot-password' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return ApiResponse.ok(null, 'Password reset successful');
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password while logged in' })
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return ApiResponse.ok(null, 'Password changed successfully');
  }

  @Post('switch-user')
  @ApiBearerAuth()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: impersonate another user (no refresh token issued)' })
  async switchUser(
    @CurrentUser('id') adminId: number,
    @Body() dto: SwitchUserDto,
  ) {
    const result = await this.authService.switchUser(adminId, dto.userId);
    return ApiResponse.ok(result, 'Switched to user successfully');
  }
}