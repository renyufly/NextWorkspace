import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { LocalStoreService } from '../local-store/local-store.service.js';
import type { LocalStoreState } from '../local-store/local-store.types.js';
import { CreateWorkspaceDto } from '../workspaces/dto/create-workspace.dto.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async listForUser(userId: string) {
    const state = await this.localStoreService.readState();

    return state.organizationMemberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => {
        const organization = state.organizations.find((candidate) => candidate.id === membership.organizationId);

        if (!organization) {
          return null;
        }

        const organizationWorkspaceIds = new Set(
          state.workspaces
            .filter((workspace) => workspace.organizationId === organization.id)
            .map((workspace) => workspace.id),
        );
        const memberCount = new Set(
          state.memberships
            .filter((workspaceMembership) => organizationWorkspaceIds.has(workspaceMembership.workspaceId))
            .map((workspaceMembership) => workspaceMembership.userId),
        ).size;

        return {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: membership.role,
          workspaceCount: organizationWorkspaceIds.size,
          memberCount,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        };
      })
      .filter((organization): organization is NonNullable<typeof organization> => organization !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async listWorkspaces(userId: string, organizationId: string) {
    const state = await this.localStoreService.readState();
    this.getOrganizationMembershipOrThrow(state, userId, organizationId);

    return state.workspaces
      .filter((workspace) => workspace.organizationId === organizationId)
      .map((workspace) => ({
        id: workspace.id,
        organizationId,
        name: workspace.name,
        slug: workspace.slug,
        currentUserRole:
          state.memberships.find(
            (membership) => membership.workspaceId === workspace.id && membership.userId === userId,
          )?.role ?? null,
        memberCount: state.memberships.filter((membership) => membership.workspaceId === workspace.id).length,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async listMembers(userId: string, organizationId: string) {
    const state = await this.localStoreService.readState();
    const actorMembership = this.getOrganizationMembershipOrThrow(state, userId, organizationId);

    if (actorMembership.role === 'MEMBER') {
      throw new ForbiddenException('Only organization admins and owners can view organization members.');
    }

    const organizationWorkspaces = state.workspaces
      .filter((workspace) => workspace.organizationId === organizationId)
      .sort((left, right) => left.name.localeCompare(right.name));

    return state.organizationMemberships
      .filter((membership) => membership.organizationId === organizationId)
      .map((membership) => {
        const user = state.users.find((candidate) => candidate.id === membership.userId);

        if (!user) {
          return null;
        }

        return {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          role: membership.role,
          isCurrentUser: user.id === userId,
          workspaceAccess: organizationWorkspaces
            .map((workspace) => {
              const workspaceMembership = state.memberships.find(
                (candidate) => candidate.workspaceId === workspace.id && candidate.userId === user.id,
              );

              if (!workspaceMembership) {
                return null;
              }

              return {
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                role: workspaceMembership.role,
              };
            })
            .filter((workspaceAccess): workspaceAccess is NonNullable<typeof workspaceAccess> => workspaceAccess !== null),
        };
      })
      .filter((member): member is NonNullable<typeof member> => member !== null)
      .sort((left, right) => this.compareRoles(left.role, right.role) || left.displayName.localeCompare(right.displayName));
  }

  async createWorkspace(userId: string, organizationId: string, dto: CreateWorkspaceDto) {
    return this.workspacesService.createInOrganization(userId, organizationId, dto);
  }

  private getOrganizationMembershipOrThrow(state: LocalStoreState, userId: string, organizationId: string) {
    const organization = state.organizations.find((candidate) => candidate.id === organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    const membership = state.organizationMemberships.find(
      (candidate) => candidate.organizationId === organizationId && candidate.userId === userId,
    );

    if (!membership) {
      throw new ForbiddenException('Organization membership is required.');
    }

    return membership;
  }

  private compareRoles(left: 'OWNER' | 'ADMIN' | 'MEMBER', right: 'OWNER' | 'ADMIN' | 'MEMBER') {
    const order = {
      OWNER: 0,
      ADMIN: 1,
      MEMBER: 2,
    } as const;

    return order[left] - order[right];
  }
}