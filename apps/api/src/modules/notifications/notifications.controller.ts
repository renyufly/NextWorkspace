import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query('workspaceId') workspaceId?: string) {
    return this.notificationsService.list(user.userId, workspaceId);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser, @Query('workspaceId') workspaceId?: string) {
    return this.notificationsService.unreadCount(user.userId, workspaceId);
  }

  @Patch(':notificationId/read')
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('notificationId') notificationId: string) {
    return this.notificationsService.markRead(user.userId, notificationId);
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthenticatedUser, @Query('workspaceId') workspaceId?: string) {
    return this.notificationsService.markAllRead(user.userId, workspaceId);
  }
}