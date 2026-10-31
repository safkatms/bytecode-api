import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NotificationService } from './notification.service';
import {
    BroadcastDto, NotificationFilterDto, RegisterPushTokenDto, UnregisterPushTokenDto,
} from './dto/notification.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    @ApiOperation({ summary: 'List own notifications' })
    async list(@Query() filter: NotificationFilterDto, @CurrentUser('id') userId: number) {
        return this.notificationService.list(userId, filter);
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Unread notification count (for the badge)' })
    async unreadCount(@CurrentUser('id') userId: number) {
        return ApiResponse.ok(await this.notificationService.unreadCount(userId));
    }

    @Patch('read-all')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark all own notifications as read' })
    async markAllRead(@CurrentUser('id') userId: number) {
        return ApiResponse.ok(await this.notificationService.markAllRead(userId), 'All marked as read');
    }

    @Delete()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete all own notifications' })
    async clearAll(@CurrentUser('id') userId: number) {
        return ApiResponse.ok(await this.notificationService.clearAll(userId), 'All notifications cleared');
    }

    @Post('push-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Register this device's Expo push token" })
    async registerPushToken(@Body() dto: RegisterPushTokenDto, @CurrentUser('id') userId: number) {
        await this.notificationService.registerPushToken(userId, dto);
        return ApiResponse.ok(null, 'Push token registered');
    }

    @Delete('push-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Unregister push token (call on logout)' })
    async unregisterPushToken(@Body() dto: UnregisterPushTokenDto, @CurrentUser('id') userId: number) {
        await this.notificationService.unregisterPushToken(userId, dto.token);
        return ApiResponse.ok(null, 'Push token removed');
    }

    @Post('broadcast')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send an announcement to all / department / team / employees (Admin)' })
    async broadcast(@Body() dto: BroadcastDto) {
        return ApiResponse.ok(await this.notificationService.broadcast(dto), 'Announcement sent');
    }

    @Patch(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a notification as read' })
    async markRead(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
        return ApiResponse.ok(await this.notificationService.markRead(userId, id));
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a notification' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
        await this.notificationService.remove(userId, id);
        return ApiResponse.ok(null, 'Notification deleted');
    }
}
