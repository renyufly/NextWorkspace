import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateWorkspaceDto } from '../workspaces/dto/create-workspace.dto.js';
import { OrganizationsService } from './organizations.service.js';

@UseGuards(AccessTokenGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listForUser(user.userId);
  }

  @Get(':organizationId/workspaces')
  async listWorkspaces(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
  ) {
    return this.organizationsService.listWorkspaces(user.userId, organizationId);
  }

  @Get(':organizationId/members')
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
  ) {
    return this.organizationsService.listMembers(user.userId, organizationId);
  }

  @Post(':organizationId/workspaces')
  async createWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.organizationsService.createWorkspace(user.userId, organizationId, dto);
  }
}