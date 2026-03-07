import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { MessagesService } from './messages.service.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';

@UseGuards(AccessTokenGuard)
@Controller('workspaces/:workspaceId/channels/:channelId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.list(user.userId, workspaceId, channelId, query);
  }

  @Post()
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(user.userId, workspaceId, channelId, dto);
  }

  @Patch(':messageId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagesService.update(user.userId, workspaceId, channelId, messageId, dto);
  }

  @Delete(':messageId')
  async softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.softDelete(user.userId, workspaceId, channelId, messageId);
  }

  @Post('read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.messagesService.markRead(user.userId, workspaceId, channelId);
  }
}