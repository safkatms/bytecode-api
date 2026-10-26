import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { EmployeeService } from '../employee/employee.service';
import { DeviceService } from '../device/device.service';
import { LoginDto } from './dto/auth.dto';
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '../../common/exceptions/app.exception';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly employeeService: EmployeeService,
    private readonly deviceService: DeviceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  // ─── Login ────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Device validation for employees only — admins are never checked
    if (user.role !== 'admin' && dto.deviceId) {
      const employee = await this.employeeService.findByUserId(user.id).catch(() => null);
      if (employee) {
        await this.deviceService.validateAndRegister(employee.id, dto.deviceId, dto.deviceName ?? null);
      }
    }

    const tokens = this.generateTokens(user);

    // persist refresh token hash so logout can invalidate it
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    const { password, refreshToken, ...safe } = user;
    return { user: safe, ...tokens };
  }

  // ─── Logout ───────────────────────────────────────────────
  async logout(userId: number) {
    await this.userService.updateRefreshToken(userId, null);
  }

  // ─── Refresh ──────────────────────────────────────────────
  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.userService.getUserById(payload.sub);
      if (!user?.refreshToken) throw new Error();

      // validate stored hash matches incoming token
      const isValid = await bcrypt.compare(token, user.refreshToken);
      if (!isValid) throw new Error();

      const tokens = this.generateTokens(user);
      await this.userService.updateRefreshToken(user.id, tokens.refreshToken);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ─── Forgot password ──────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);
    // always return 200 — never leak whether email exists
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.userService.savePasswordResetToken(user.id, tokenHash, expiresAt);

    // TODO: send rawToken via email — plug in your mailer here
    // In dev, log it so you can test without a real mailer
    if (this.configService.get('NODE_ENV') === 'development') {
      console.log(`[DEV] Password reset token for ${email}: ${rawToken}`);
    }
  }

  // ─── Reset password ───────────────────────────────────────
  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = await this.userService.findByResetToken(tokenHash);

    if (!user) throw new BadRequestException('Invalid or expired reset token');
    if (user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(user.id, hashed);
  }

  // ─── Change password (authenticated) ─────────────────────
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.userService.getUserById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(userId, hashed);
  }

  // ─── Token factory ────────────────────────────────────────
  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    };
  }

  async switchUser(adminId: number, targetUserId: number) {
    // remove: admin role check — enforced by @Roles guard at controller level

    const target = await this.userService.getUserById(targetUserId);

    if (!target.isActive || target.deletedAt) {
      throw new BadRequestException('Target user is inactive or deleted');
    }

    const payload = {
      sub: target.id,
      email: target.email,
      role: target.role,
      impersonatedBy: adminId,
    };

    const accessToken = this.jwtService.sign(payload);
    const { password, refreshToken, ...safeTarget } = target;

    return {
      accessToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
      impersonatedUser: safeTarget,
    };
  }
}