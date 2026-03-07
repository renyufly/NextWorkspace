import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

import { createUniqueSlug } from '../../common/slugify.js';
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
  constructor(private readonly localStoreService: LocalStoreService) {}

  async listForUser(userId: string) {
    const state = await this.localStoreService.readState();

    return state.memberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => {
        const workspace = state.workspaces.find((candidate) => candidate.id === membership.workspaceId);

        if (!workspace) {
          return null;
        }

        return {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: membership.role,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        };
      })
      .filter((workspace): workspace is NonNullable<typeof workspace> => workspace !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const now = new Date().toISOString();

    return this.localStoreService.updateState((state) => {
      const user = state.users.find((candidate) => candidate.id === userId);

      if (!user) {
        throw new ForbiddenException('Current user does not exist.');
      }

      const slug = createUniqueSlug(
        dto.name,
        state.workspaces.map((workspace) => workspace.slug),
      );

      const workspace: LocalWorkspaceRecord = {
        id: randomUUID(),
        name: dto.name.trim(),
        slug,
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      };
      const membership: LocalWorkspaceMembershipRecord = {
        id: randomUUID(),
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
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

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: membership.role,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    });
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
        const slug = createUniqueSlug(
          trimmedName,
          state.workspaces.filter((w) => w.id !== workspaceId).map((w) => w.slug),
        );

        workspace.name = trimmedName;
        workspace.slug = slug;
      }

      workspace.updatedAt = new Date().toISOString();

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: membership.role,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
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

      const workspace = this.getWorkspaceOrThrow(state, invitation.workspaceId);

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: membership.role,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
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

      if (actorUserId === memberUserId) {
        throw new BadRequestException('Use a different account to change your own role.');
      }

      this.assertCanManageRole(actorMembership.role, targetMembership.role, dto.role);
      targetMembership.role = dto.role;

      const targetUser = state.users.find((candidate) => candidate.id === memberUserId);

      if (!targetUser) {
        throw new NotFoundException('Workspace member user not found.');
      }

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

      if (memberUserId === actorUserId) {
        if (actorMembership.role === 'OWNER') {
          throw new BadRequestException('Workspace owners cannot leave their own workspace.');
        }
      } else {
        this.assertCanManageRole(actorMembership.role, targetMembership.role, targetMembership.role);
      }

      this.removeWorkspaceMemberArtifacts(state, workspaceId, memberUserId);

      return {
        success: true,
      };
    });
  }

  async leaveWorkspace(userId: string, workspaceId: string) {
    return this.localStoreService.updateState((state) => {
      const membership = this.getMembershipOrThrow(state, userId, workspaceId);

      if (membership.role === 'OWNER') {
        throw new BadRequestException('Workspace owners cannot leave their own workspace.');
      }

      this.removeWorkspaceMemberArtifacts(state, workspaceId, userId);

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
}