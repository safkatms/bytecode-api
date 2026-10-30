import { BadRequestException, Injectable } from '@nestjs/common';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserRepository } from './user.repository';
import { CreateUserDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto';
import { BaseService } from '../../common/services/base.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/response/paginated-response';
import {
  ConflictException,
  NotFoundException,
} from '../../common/exceptions/app.exception';

@Injectable()
export class UserService extends BaseService<
  User,
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cloudinary: CloudinaryService,
  ) {
    super(userRepository, 'User');
  }

  // ─── Generate a readable one-time password ────────────────
  // Format: Xxxx@1234  — always satisfies the strong-password regex
  generateOtp(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@$!%*?&^#';
    const all = upper + lower + digits + special;

    const rand = (str: string) => str[crypto.randomInt(str.length)];

    // Guarantee at least one of each required char class
    const required = [
      rand(upper),
      rand(lower),
      rand(digits),
      rand(special),
    ];

    // Fill remaining 4 chars from the full pool
    const rest = Array.from({ length: 4 }, () => rand(all));

    // Shuffle so required chars aren't always at fixed positions
    return [...required, ...rest]
      .sort(() => crypto.randomInt(3) - 1)
      .join('');
  }

  // ─── Create user (admin) ──────────────────────────────────
  async createUser(dto: CreateUserDto, adminId: number): Promise<{ user: User; plainPassword: string }> {
    const exists = await this.userRepository.findByEmail(dto.email);
    if (exists) throw new ConflictException('A user with this email already exists');

    const plainPassword = this.generateOtp();
    const hashed = await bcrypt.hash(plainPassword, 12);

    const user = await this.userRepository.create({
      ...dto,
      password: hashed,
      mustChangePassword: true,   // forces change on first login
      passwordChangedAt: new Date(),
      createdBy: adminId,
      updatedBy: adminId,
    });

    // TODO: email plainPassword to user — plug mailer here
    // In dev, log it so you can test without a mailer
    console.log(`[DEV] One-time password for ${user.email}: ${plainPassword}`);

    return { user, plainPassword };
  }

  async getUsers(pagination: PaginationDto): Promise<PaginatedResponse<User>> {
    return this.userRepository.searchUsers(pagination);
  }

  async getUserById(id: number): Promise<User> {
    return this.findById(id);
  }

  async updateUser(id: number, dto: UpdateUserDto, adminId: number): Promise<User> {
    await this.findById(id);

    if (dto.email) {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email is already in use by another user');
      }
    }

    return this.userRepository.update(id, { ...dto, updatedBy: adminId });
  }

  async removeUser(id: number): Promise<User> {
    return this.remove(id);
  }

  async uploadAvatar(userId: number, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
    if (!file) throw new BadRequestException('Image file is required');
    await this.findById(userId);
    const result = await this.cloudinary.uploadImage(file.buffer, 'employee-avatars', `user-${userId}`);
    await this.userRepository.update(userId, { avatarUrl: result.secure_url, updatedBy: userId });
    return { avatarUrl: result.secure_url };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    await this.findById(userId);

    if (dto.email) {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email is already in use by another user');
      }
    }

    return this.userRepository.update(userId, { ...dto, updatedBy: userId });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async toggleActive(id: number, adminId: number): Promise<User> {
    const user = await this.findById(id);
    return this.userRepository.update(id, {
      isActive: !user.isActive,
      updatedBy: adminId,
    });
  }

  // ─── Called by auth.service ───────────────────────────────
  async updateRefreshToken(userId: number, token: string | null) {
    const hashed = token ? await bcrypt.hash(token, 10) : null;
    await this.userRepository.update(userId, { refreshToken: hashed, updatedBy: userId });
  }

  async savePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date) {
    await this.userRepository.update(userId, {
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: expiresAt,
      updatedBy: userId,
    });
  }

  async findByResetToken(tokenHash: string) {
    return this.userRepository.findOne({
      where: { passwordResetToken: tokenHash, deletedAt: null },
    });
  }

  async updatePassword(userId: number, hashedPassword: string) {
    await this.userRepository.update(userId, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      updatedBy: userId,
    });
  }

  // ─── Reset OTP — admin re-issues a fresh one-time password ─
  async resetUserOtp(userId: number, adminId: number): Promise<{ plainPassword: string }> {
    await this.findById(userId);

    const plainPassword = this.generateOtp();
    const hashed = await bcrypt.hash(plainPassword, 12);

    await this.userRepository.update(userId, {
      password: hashed,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      updatedBy: adminId,
    });

    console.log(`[DEV] New OTP for user #${userId}: ${plainPassword}`);
    return { plainPassword };
  }
}