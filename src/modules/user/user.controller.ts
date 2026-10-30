import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UserService } from './user.service';
import { CreateUserDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Create user with auto-generated one-time password (Admin only)' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') adminId: number,
  ) {
    const { user, plainPassword } = await this.userService.createUser(dto, adminId);
    const { password, refreshToken, ...safe } = user;
    return ApiResponse.created(
      { user: safe, temporaryPassword: plainPassword },
      'User created — share the temporary password securely',
    );
  }

  @Get()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get all users paginated (Admin only)' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.userService.getUsers(pagination);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@CurrentUser() user: any) {
    const { password, refreshToken, ...safe } = user;
    return ApiResponse.ok(safe, 'Profile retrieved');
  }

  @Get(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.getUserById(id);
    const { password, refreshToken, ...safe } = user;
    return ApiResponse.ok(safe);
  }

  @Patch('me')
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Update own profile (all users)' })
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser('id') userId: number,
  ) {
    const user = await this.userService.updateProfile(userId, dto);
    const { password, refreshToken, ...safe } = user;
    return ApiResponse.ok(safe, 'Profile updated successfully');
  }

  @Post('me/avatar')
  @Roles(Role.admin, Role.user)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload own profile image, form field "file" (all users)' })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      /^image\/(jpe?g|png|webp)$/.test(file.mimetype)
        ? cb(null, true)
        : cb(new BadRequestException('Only jpg, png or webp images are allowed'), false),
  }))
  async uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: number,
  ) {
    return ApiResponse.ok(await this.userService.uploadAvatar(userId, file), 'Profile image updated');
  }

  @Patch(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update user info — no password (Admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') adminId: number,
  ) {
    const user = await this.userService.updateUser(id, dto, adminId);
    const { password, refreshToken, ...safe } = user;
    return ApiResponse.ok(safe, 'User updated successfully');
  }

  @Post(':id/reset-otp')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Re-issue a fresh one-time password for a user (Admin only)' })
  async resetOtp(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    const { plainPassword } = await this.userService.resetUserOtp(id, adminId);
    return ApiResponse.ok(
      { temporaryPassword: plainPassword },
      'New temporary password issued — share it securely',
    );
  }

  @Patch(':id/toggle-active')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Toggle user active status (Admin only)' })
  async toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    const user = await this.userService.toggleActive(id, adminId);
    return ApiResponse.ok(user, `User ${user.isActive ? 'activated' : 'deactivated'}`);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a user (Admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.userService.removeUser(id);
    return ApiResponse.ok(null, 'User deleted successfully');
  }
}