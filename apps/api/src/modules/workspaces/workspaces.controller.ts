import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@UseGuards(AccessTokenGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.listForUser(user.userId);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.userId, dto);
  }

  @Patch(':workspaceId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(user.userId, workspaceId, dto);
  }

  @Get(':workspaceId/members')
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspacesService.listMembers(user.userId, workspaceId);
  }

  @Patch(':workspaceId/members/:memberUserId')
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(user.userId, workspaceId, memberUserId, dto);
  }

  @Delete(':workspaceId/members/:memberUserId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.workspacesService.removeMember(user.userId, workspaceId, memberUserId);
  }

  @Get(':workspaceId/invitations')
  async listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspacesService.listInvitations(user.userId, workspaceId);
  }

  @Post(':workspaceId/invitations')
  async createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.workspacesService.createInvitation(user.userId, workspaceId, dto);
  }

  @Delete(':workspaceId/invitations/:invitationId')
  async revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspacesService.revokeInvitation(user.userId, workspaceId, invitationId);
  }

  @Post('invitations/accept')
  async acceptInvitation(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptInvitationDto) {
    return this.workspacesService.acceptInvitation(user, dto);
  }

  @Post(':workspaceId/leave')
  async leaveWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspacesService.leaveWorkspace(user.userId, workspaceId);
  }
}