import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AddChannelMemberDto } from './dto/add-channel-member.dto.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { UpdateChannelDto } from './dto/update-channel.dto.js';
import { ChannelsService } from './channels.service.js';

@UseGuards(AccessTokenGuard)
@Controller('workspaces/:workspaceId/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string) {
    return this.channelsService.list(user.userId, workspaceId);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.create(user.userId, workspaceId, dto);
  }

  @Patch(':channelId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(user.userId, workspaceId, channelId, dto);
  }

  @Delete(':channelId')
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.delete(user.userId, workspaceId, channelId);
  }

  @Get(':channelId/members')
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.listMembers(user.userId, workspaceId, channelId);
  }

  @Post(':channelId/members')
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: AddChannelMemberDto,
  ) {
    return this.channelsService.addMember(user.userId, workspaceId, channelId, dto.userId);
  }

  @Delete(':channelId/members/:memberUserId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.channelsService.removeMember(user.userId, workspaceId, channelId, memberUserId);
  }
}