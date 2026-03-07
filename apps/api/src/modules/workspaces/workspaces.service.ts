import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

import { createUniqueSlug } from '../../common/slugify.js';
import { AuditService } from '../audit/audit.service.js';
import {
  type LocalChannelRecord,
  type LocalInvitationRecord,
  type LocalStoreState,
  type LocalWorkspaceMembershipRecord,
  type LocalWorkspaceRecord,
  type LocalUserRecord,
} from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto.js';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly auditService: AuditService,
  ) {}

  async listForUser(userId: string) {
    const state = await this.localStoreService.readState();

    return state.memberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => {
        const workspace = state.workspaces.find((candidate) => candidate.id === membership.workspaceId);

        if (!workspace) {
          return null;
        }

        return this.serializeWorkspaceSummary(state, workspace, membership.role);
      })
      .filter((workspace): workspace is NonNullable<typeof workspace> => workspace !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    return this.localStoreService.updateState((state) =>
      this.createWorkspace(state, userId, dto.name, dto.organizationId ?? null),
    );
  }

  async createInOrganization(userId: string, organizationId: string, dto: CreateWorkspaceDto) {
    return this.localStoreService.updateState((state) => this.createWorkspace(state, userId, dto.name, organizationId));
  }

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    return this.localStoreService.updateState((state) => {
      const membership = this.getMembershipOrThrow(state, userId, workspaceId);

      if (membership.role === 'MEMBER') {
        throw new ForbiddenException('Only admins and owners can update workspace settings.');
      }

      const workspace = this.getWorkspaceOrThrow(state, workspaceId);

      if (dto.name) {
        const trimmedName = dto.name.trim();
        const previousName = workspace.name;
        const slug = createUniqueSlug(
          trimmedName,
          state.workspaces.filter((w) => w.id !== workspaceId).map((w) => w.slug),
        );

        workspace.name = trimmedName;
        workspace.slug = slug;
      }

      workspace.updatedAt = new Date().toISOString();
      this.auditService.append(state, {
        workspaceId,
        actorUserId: userId,
        action: 'WORKSPACE_UPDATED',
        entityType: 'WORKSPACE',
        entityId: workspace.id,
        entityLabel: workspace.name,
        metadata: {
          slug: workspace.slug,
        },
      });

      return this.serializeWorkspaceSummary(state, workspace, membership.role);
    });
  }

  async assertMembership(userId: string, workspaceId: string) {
    const state = await this.localStoreService.readState();
    return this.getMembershipOrThrow(state, userId, workspaceId);
  }

  async listMembers(userId: string, workspaceId: string) {
    const state = await this.localStoreService.readState();
    this.getMembershipOrThrow(state, userId, workspaceId);

    return state.memberships
      .filter((membership) => membership.workspaceId === workspaceId)
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
          joinedAt: membership.joinedAt,
          isCurrentUser: user.id === userId,
        };
      })
      .filter((member): member is NonNullable<typeof member> => member !== null)
      .sort((left, right) => this.compareRoles(left.role, right.role) || left.displayName.localeCompare(right.displayName));
  }

  async createInvitation(userId: string, workspaceId: string, dto: CreateInvitationDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const now = new Date().toISOString();

    return this.localStoreService.updateState((state) => {
      const actorMembership = this.getMembershipOrThrow(state, userId, workspaceId);
      this.assertCanInvite(actorMembership.role, dto.role);

      this.getWorkspaceOrThrow(state, workspaceId);

      const invitedUser = state.users.find((candidate) => candidate.email === normalizedEmail);

      if (
        invitedUser &&
        state.memberships.some(
          (membership) => membership.workspaceId === workspaceId && membership.userId === invitedUser.id,
        )
      ) {
        throw new ConflictException('That user is already a workspace member.');
      }

      if (
        state.invitations.some(
          (invitation) =>
            invitation.workspaceId === workspaceId &&
            invitation.email === normalizedEmail &&
            invitation.acceptedAt === null &&
            new Date(invitation.expiresAt).getTime() > Date.now(),
        )
      ) {
        throw new ConflictException('A pending invitation already exists for that email.');
      }

      const invitation: LocalInvitationRecord = {
        id: randomUUID(),
        workspaceId,
        email: normalizedEmail,
        token: randomBytes(16).toString('hex'),
        role: dto.role,
        invitedById: userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        acceptedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      state.invitations.push(invitation);
      this.auditService.append(state, {
        workspaceId,
        actorUserId: userId,
        action: 'INVITATION_CREATED',
        entityType: 'INVITATION',
        entityId: invitation.id,
        entityLabel: normalizedEmail,
        metadata: {
          email: normalizedEmail,
          role: invitation.role,
        },
      });

      return this.serializeInvitation(state, invitation);
    });
  }

  async listInvitations(userId: string, workspaceId: string) {
    const state = await this.localStoreService.readState();
    const actorMembership = this.getMembershipOrThrow(state, userId, workspaceId);

    if (actorMembership.role === 'MEMBER') {
      throw new ForbiddenException('Only admins and owners can view invitations.');
    }

    return state.invitations
      .filter((invitation) => invitation.workspaceId === workspaceId && invitation.acceptedAt === null)
      .map((invitation) => this.serializeInvitation(state, invitation))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async revokeInvitation(userId: string, workspaceId: string, invitationId: string) {
    return this.localStoreService.updateState((state) => {
      const actorMembership = this.getMembershipOrThrow(state, userId, workspaceId);
      const invitation = state.invitations.find(
        (candidate) => candidate.id === invitationId && candidate.workspaceId === workspaceId,
      );

      if (!invitation || invitation.acceptedAt !== null) {
        throw new NotFoundException('Pending invitation not found.');
      }

      if (actorMembership.role === 'MEMBER') {
        throw new ForbiddenException('Only admins and owners can revoke invitations.');
      }

      if (actorMembership.role === 'ADMIN' && invitation.role !== 'MEMBER') {
        throw new ForbiddenException('Admins can only revoke member invitations.');
      }

      state.invitations = state.invitations.filter((candidate) => candidate.id !== invitationId);
      this.auditService.append(state, {
        workspaceId,
        actorUserId: userId,
        action: 'INVITATION_REVOKED',
        entityType: 'INVITATION',
        entityId: invitation.id,
        entityLabel: invitation.email,
        metadata: {
          email: invitation.email,
          role: invitation.role,
        },
      });

      return { success: true };
    });
  }

  async acceptInvitation(user: AuthenticatedUser, dto: AcceptInvitationDto) {
    const token = dto.token.trim();
    const now = new Date().toISOString();

    return this.localStoreService.updateState((state) => {
      const currentUser = state.users.find((candidate) => candidate.id === user.userId);

      if (!currentUser) {
        throw new ForbiddenException('Current user does not exist.');
      }

      const invitation = state.invitations.find(
        (candidate) => candidate.token === token && candidate.acceptedAt === null,
      );

      if (!invitation) {
        throw new NotFoundException('Invitation token was not found.');
      }

      if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
        throw new BadRequestException('Invitation token has expired.');
      }

      if (invitation.email !== currentUser.email) {
        throw new ForbiddenException('This invitation does not belong to your account.');
      }

      if (
        state.memberships.some(
          (membership) => membership.workspaceId === invitation.workspaceId && membership.userId === user.userId,
        )
      ) {
        throw new ConflictException('You are already a member of this workspace.');
      }

      const membership: LocalWorkspaceMembershipRecord = {
        id: randomUUID(),
        workspaceId: invitation.workspaceId,
        userId: user.userId,
        role: invitation.role,
        joinedAt: now,
      };

      invitation.acceptedAt = now;
      invitation.updatedAt = now;
      state.memberships.push(membership);
      this.auditService.append(state, {
        workspaceId: invitation.workspaceId,
        actorUserId: user.userId,
        action: 'INVITATION_ACCEPTED',
        entityType: 'INVITATION',
        entityId: invitation.id,
        entityLabel: invitation.email,
        targetUserId: user.userId,
        metadata: {
          role: invitation.role,
        },
        createdAt: now,
      });

      const workspace = this.getWorkspaceOrThrow(state, invitation.workspaceId);
      this.reconcileOrganizationMembership(state, workspace.organizationId, user.userId);

      return this.serializeWorkspaceSummary(state, workspace, membership.role);
    });
  }

  async updateMemberRole(
    actorUserId: string,
    workspaceId: string,
    memberUserId: string,
    dto: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.localStoreService.updateState((state) => {
      const actorMembership = this.getMembershipOrThrow(state, actorUserId, workspaceId);
      const targetMembership = this.getMembershipOrThrow(state, memberUserId, workspaceId);
      const workspace = this.getWorkspaceOrThrow(state, workspaceId);

      if (actorUserId === memberUserId) {
        throw new BadRequestException('Use a different account to change your own role.');
      }

      this.assertCanManageRole(actorMembership.role, targetMembership.role, dto.role);
      const previousRole = targetMembership.role;
      targetMembership.role = dto.role;
  this.reconcileOrganizationMembership(state, workspace.organizationId, memberUserId);

      const targetUser = state.users.find((candidate) => candidate.id === memberUserId);

      if (!targetUser) {
        throw new NotFoundException('Workspace member user not found.');
      }

      this.auditService.append(state, {
        workspaceId,
        actorUserId: actorUserId,
        action: 'MEMBER_ROLE_UPDATED',
        entityType: 'WORKSPACE_MEMBER',
        entityId: `${workspaceId}:${memberUserId}`,
        entityLabel: targetUser.displayName,
        targetUserId: memberUserId,
        metadata: {
          previousRole,
          nextRole: dto.role,
        },
      });

      return {
        userId: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        role: targetMembership.role,
        joinedAt: targetMembership.joinedAt,
        isCurrentUser: false,
      };
    });
  }

  async removeMember(actorUserId: string, workspaceId: string, memberUserId: string) {
    return this.localStoreService.updateState((state) => {
      const actorMembership = this.getMembershipOrThrow(state, actorUserId, workspaceId);
      const targetMembership = this.getMembershipOrThrow(state, memberUserId, workspaceId);
      const workspace = this.getWorkspaceOrThrow(state, workspaceId);

      if (memberUserId === actorUserId) {
        if (actorMembership.role === 'OWNER') {
          throw new BadRequestException('Workspace owners cannot leave their own workspace.');
        }
      } else {
        this.assertCanManageRole(actorMembership.role, targetMembership.role, targetMembership.role);
      }

      this.removeWorkspaceMemberArtifacts(state, workspaceId, memberUserId);
      this.reconcileOrganizationMembership(state, workspace.organizationId, memberUserId);
      this.auditService.append(state, {
        workspaceId,
        actorUserId: actorUserId,
        action: 'MEMBER_REMOVED',
        entityType: 'WORKSPACE_MEMBER',
        entityId: `${workspaceId}:${memberUserId}`,
        targetUserId: memberUserId,
      });

      return {
        success: true,
      };
    });
  }

  async leaveWorkspace(userId: string, workspaceId: string) {
    return this.localStoreService.updateState((state) => {
      const membership = this.getMembershipOrThrow(state, userId, workspaceId);
      const workspace = this.getWorkspaceOrThrow(state, workspaceId);

      if (membership.role === 'OWNER') {
        throw new BadRequestException('Workspace owners cannot leave their own workspace.');
      }

      this.removeWorkspaceMemberArtifacts(state, workspaceId, userId);
      this.reconcileOrganizationMembership(state, workspace.organizationId, userId);

      return {
        success: true,
      };
    });
  }

  private getWorkspaceOrThrow(state: LocalStoreState, workspaceId: string) {
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return workspace;
  }

  private getMembershipOrThrow(state: LocalStoreState, userId: string, workspaceId: string) {
    const membership = state.memberships.find(
      (candidate) => candidate.userId === userId && candidate.workspaceId === workspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('Workspace membership is required.');
    }

    return membership;
  }

  private getOrganizationOrThrow(state: LocalStoreState, organizationId: string) {
    const organization = state.organizations.find((candidate) => candidate.id === organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    return organization;
  }

  private getOrganizationMembershipOrThrow(state: LocalStoreState, userId: string, organizationId: string) {
    const membership = state.organizationMemberships.find(
      (candidate) => candidate.userId === userId && candidate.organizationId === organizationId,
    );

    if (!membership) {
      throw new ForbiddenException('Organization membership is required.');
    }

    return membership;
  }

  private assertCanInvite(actorRole: LocalWorkspaceMembershipRecord['role'], invitedRole: LocalWorkspaceMembershipRecord['role']) {
    if (actorRole === 'MEMBER') {
      throw new ForbiddenException('Only admins and owners can invite users.');
    }

    if (actorRole === 'ADMIN' && invitedRole !== 'MEMBER') {
      throw new ForbiddenException('Admins can only invite members.');
    }
  }

  private assertCanManageRole(
    actorRole: LocalWorkspaceMembershipRecord['role'],
    targetRole: LocalWorkspaceMembershipRecord['role'],
    nextRole: LocalWorkspaceMembershipRecord['role'],
  ) {
    if (actorRole === 'MEMBER') {
      throw new ForbiddenException('Members cannot manage workspace roles.');
    }

    if (targetRole === 'OWNER') {
      throw new ForbiddenException('Workspace owners cannot be modified.');
    }

    if (actorRole === 'ADMIN') {
      if (targetRole === 'ADMIN' || nextRole !== 'MEMBER') {
        throw new ForbiddenException('Admins can only manage member roles.');
      }
    }
  }

  private serializeInvitation(state: LocalStoreState, invitation: LocalInvitationRecord) {
    const invitedBy = state.users.find((candidate) => candidate.id === invitation.invitedById);

    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      invitedBy: invitedBy
        ? {
            id: invitedBy.id,
            displayName: invitedBy.displayName,
            email: invitedBy.email,
          }
        : null,
    };
  }

  private serializeWorkspaceSummary(
    state: LocalStoreState,
    workspace: LocalWorkspaceRecord,
    role: LocalWorkspaceMembershipRecord['role'],
  ) {
    const organization = this.getOrganizationOrThrow(state, workspace.organizationId);

    return {
      id: workspace.id,
      organizationId: organization.id,
      organizationName: organization.name,
      name: workspace.name,
      slug: workspace.slug,
      role,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  private compareRoles(left: LocalWorkspaceMembershipRecord['role'], right: LocalWorkspaceMembershipRecord['role']) {
    const order = {
      OWNER: 0,
      ADMIN: 1,
      MEMBER: 2,
    } as const;

    return order[left] - order[right];
  }

  private removeWorkspaceMemberArtifacts(state: LocalStoreState, workspaceId: string, userId: string) {
    state.memberships = state.memberships.filter(
      (membership) => !(membership.workspaceId === workspaceId && membership.userId === userId),
    );
    state.channelMemberships = state.channelMemberships.filter(
      (membership) => !(membership.workspaceId === workspaceId && membership.userId === userId),
    );
    state.channelReadStates = state.channelReadStates.filter(
      (readState) => !(readState.workspaceId === workspaceId && readState.userId === userId),
    );
    state.notifications = state.notifications.filter(
      (notification) => !(notification.workspaceId === workspaceId && notification.userId === userId),
    );
  }

  private createWorkspace(
    state: LocalStoreState,
    userId: string,
    workspaceName: string,
    organizationId: string | null,
  ) {
    const now = new Date().toISOString();
    const user = state.users.find((candidate) => candidate.id === userId);

    if (!user) {
      throw new ForbiddenException('Current user does not exist.');
    }

    const slug = createUniqueSlug(
      workspaceName,
      state.workspaces.map((workspace) => workspace.slug),
    );

    let resolvedOrganizationId = organizationId;
    let workspaceRole: LocalWorkspaceMembershipRecord['role'] = 'OWNER';

    if (resolvedOrganizationId) {
      const organizationMembership = this.getOrganizationMembershipOrThrow(state, userId, resolvedOrganizationId);

      if (organizationMembership.role === 'MEMBER') {
        throw new ForbiddenException('Only organization admins and owners can create workspaces.');
      }

      this.getOrganizationOrThrow(state, resolvedOrganizationId);
      workspaceRole = organizationMembership.role === 'OWNER' ? 'OWNER' : 'ADMIN';
    } else {
      const organizationSlug = createUniqueSlug(
        workspaceName,
        state.organizations.map((organization) => organization.slug),
      );
      const organization = {
        id: randomUUID(),
        name: workspaceName.trim(),
        slug: organizationSlug,
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      };

      state.organizations.push(organization);
      state.organizationMemberships.push({
        id: randomUUID(),
        organizationId: organization.id,
        userId,
        role: 'OWNER',
        joinedAt: now,
      });
      resolvedOrganizationId = organization.id;
    }

    const workspace: LocalWorkspaceRecord = {
      id: randomUUID(),
      organizationId: resolvedOrganizationId,
      name: workspaceName.trim(),
      slug,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    };
    const membership: LocalWorkspaceMembershipRecord = {
      id: randomUUID(),
      workspaceId: workspace.id,
      userId,
      role: workspaceRole,
      joinedAt: now,
    };
    const generalChannel: LocalChannelRecord = {
      id: randomUUID(),
      workspaceId: workspace.id,
      name: 'general',
      description: 'Default team channel',
      type: 'PUBLIC',
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    };

    if (state.workspaces.some((candidate) => candidate.slug === workspace.slug)) {
      throw new ConflictException('A workspace with that slug already exists.');
    }

    state.workspaces.push(workspace);
    state.memberships.push(membership);
    state.channels.push(generalChannel);
    this.reconcileOrganizationMembership(state, resolvedOrganizationId, userId);
    this.auditService.append(state, {
      workspaceId: workspace.id,
      actorUserId: userId,
      action: 'WORKSPACE_CREATED',
      entityType: 'WORKSPACE',
      entityId: workspace.id,
      entityLabel: workspace.name,
      metadata: {
        slug: workspace.slug,
        organizationId: resolvedOrganizationId,
      },
    });

    return this.serializeWorkspaceSummary(state, workspace, membership.role);
  }

  private reconcileOrganizationMembership(state: LocalStoreState, organizationId: string, userId: string) {
    const workspaceIds = new Set(
      state.workspaces
        .filter((workspace) => workspace.organizationId === organizationId)
        .map((workspace) => workspace.id),
    );
    const relevantMemberships = state.memberships
      .filter((membership) => membership.userId === userId && workspaceIds.has(membership.workspaceId))
      .sort((left, right) => this.compareRoles(left.role, right.role));
    const existingMembership = state.organizationMemberships.find(
      (membership) => membership.organizationId === organizationId && membership.userId === userId,
    );

    if (relevantMemberships.length === 0) {
      if (existingMembership) {
        state.organizationMemberships = state.organizationMemberships.filter(
          (membership) => !(membership.organizationId === organizationId && membership.userId === userId),
        );
      }

      return;
    }

    const nextRole = relevantMemberships[0]?.role ?? 'MEMBER';
    const joinedAt = relevantMemberships
      .map((membership) => membership.joinedAt)
      .sort((left, right) => left.localeCompare(right))[0] ?? new Date().toISOString();

    if (existingMembership) {
      existingMembership.role = nextRole;
      existingMembership.joinedAt = existingMembership.joinedAt.localeCompare(joinedAt) <= 0
        ? existingMembership.joinedAt
        : joinedAt;
      return;
    }

    state.organizationMemberships.push({
      id: randomUUID(),
      organizationId,
      userId,
      role: nextRole,
      joinedAt,
    });
  }
}