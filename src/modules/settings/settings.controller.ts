import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
    constructor(private readonly service: SettingsService) { }

    @Get()
    @ApiOperation({ summary: 'Get system settings (All users)' })
    async get() {
        return ApiResponse.ok(await this.service.getAll());
    }

    @Put()
    @Roles(Role.admin)
    @ApiOperation({ summary: 'Update system settings (Admin)' })
    async update(@Body() dto: UpdateSettingsDto, @CurrentUser('id') adminId: number) {
        return ApiResponse.ok(await this.service.update(dto, adminId), 'Settings saved');
    }
}
