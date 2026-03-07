import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { slugify } from '../../common/slugify.js';
import type {
  LocalChannelMembershipRecord,
  LocalChannelRecord,
  LocalStoreState,
  LocalWorkspaceMembershipRecord,
} from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import type { UpdateChannelDto } from './dto/update-channel.dto.js';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async list(userId: string, workspaceId: string) {
    await this.workspacesService.assertMembership(userId, workspaceId);

    const state = await this.localStoreService.readState();

    return state.channels
      .filter(
        (channel) =>
          channel.workspaceId === workspaceId &&
          (channel.type === 'PUBLIC' || this.isChannelMember(state, channel.id, userId)),
      )
      .map((channel) => this.serializeChannel(state, channel, userId))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async create(userId: string, workspaceId: string, dto: CreateChannelDto) {
    await this.workspacesService.assertMembership(userId, workspaceId);

    const now = new Date().toISOString();
    const normalizedName = slugify(dto.name);

    if (!normalizedName) {
      throw new ConflictException('Channel name must contain letters or numbers.');
    }

    return this.localStoreService.updateState((state) => {
      const membership = this.getWorkspaceMembershipOrThrow(state, userId, workspaceId);
      const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);

      if (!workspace) {
        throw new NotFoundException('Workspace not found.');
      }

      if (
        state.channels.some(
          (channel) => channel.workspaceId === workspaceId && slugify(channel.name) === normalizedName,
        )
      ) {
        throw new ConflictException('A channel with that name already exists in this workspace.');
      }

      const channel: LocalChannelRecord = {
        id: randomUUID(),
        workspaceId,
        name: normalizedName,
        description: dto.description?.trim() ?? null,
        type: dto.type ?? 'PUBLIC',
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      };

      state.channels.push(channel);

      if (channel.type === 'PRIVATE') {
        if (membership.role === 'MEMBER') {
          throw new ForbiddenException('Only admins and owners can create private channels.');
        }

        state.channelMemberships.push({
          id: randomUUID(),
          workspaceId,
          channelId: channel.id,
          userId,
          addedById: userId,
          joinedAt: now,
        });
      }

      return this.serializeChannel(state, channel, userId);
    });
  }

  async listMembers(userId: string, workspaceId: string, channelId: string) {
    const state = await this.localStoreService.readState();
    const actorWorkspaceMembership = this.getWorkspaceMembershipOrThrow(state, userId, workspaceId);
    const channel = this.getChannelOrThrow(state, workspaceId, channelId);
    this.assertCanViewChannelMembers(state, actorWorkspaceMembership, channel, userId);

    if (channel.type === 'PUBLIC') {
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
            joinedAt: membership.joinedAt,
            isCurrentUser: user.id === userId,
          };
        })
        .filter((member): member is NonNullable<typeof member> => member !== null)
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
    }

    return state.channelMemberships
      .filter((membership) => membership.workspaceId === workspaceId && membership.channelId === channelId)
      .map((membership) => {
        const user = state.users.find((candidate) => candidate.id === membership.userId);

        if (!user) {
          return null;
        }

        return {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          joinedAt: membership.joinedAt,
          isCurrentUser: user.id === userId,
        };
      })
      .filter((member): member is NonNullable<typeof member> => member !== null)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  async addMember(actorUserId: string, workspaceId: string, channelId: string, memberUserId: string) {
    const now = new Date().toISOString();

    return this.localStoreService.updateState((state) => {
      const actorWorkspaceMembership = this.getWorkspaceMembershipOrThrow(state, actorUserId, workspaceId);
      const channel = this.getChannelOrThrow(state, workspaceId, channelId);
      this.assertCanManageChannelMembers(state, actorWorkspaceMembership, channel, actorUserId);

      if (channel.type !== 'PRIVATE') {
        throw new ConflictException('Public channels do not require channel membership management.');
      }

      this.getWorkspaceMembershipOrThrow(state, memberUserId, workspaceId);

      if (this.isChannelMember(state, channelId, memberUserId)) {
        throw new ConflictException('That user is already a channel member.');
      }

      const user = state.users.find((candidate) => candidate.id === memberUserId);

      if (!user) {
        throw new NotFoundException('Workspace member user not found.');
      }

      state.channelMemberships.push({
        id: randomUUID(),
        workspaceId,
        channelId,
        userId: memberUserId,
        addedById: actorUserId,
        joinedAt: now,
      });

      return {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        joinedAt: now,
        isCurrentUser: user.id === actorUserId,
      };
    });
  }

  async removeMember(actorUserId: string, workspaceId: string, channelId: string, memberUserId: string) {
    return this.localStoreService.updateState((state) => {
      const actorWorkspaceMembership = this.getWorkspaceMembershipOrThrow(state, actorUserId, workspaceId);
      const channel = this.getChannelOrThrow(state, workspaceId, channelId);
      this.assertCanManageChannelMembers(state, actorWorkspaceMembership, channel, actorUserId);

      if (channel.type !== 'PRIVATE') {
        throw new ConflictException('Public channels do not require channel membership management.');
      }

      if (channel.createdById === memberUserId) {
        throw new ForbiddenException('The private channel creator cannot be removed.');
      }

      const beforeCount = state.channelMemberships.length;
      state.channelMemberships = state.channelMemberships.filter(
        (membership) =>
          !(
            membership.workspaceId === workspaceId &&
            membership.channelId === channelId &&
            membership.userId === memberUserId
          ),
      );

      if (beforeCount === state.channelMemberships.length) {
        throw new NotFoundException('Channel membership not found.');
      }

      state.channelReadStates = state.channelReadStates.filter(
        (readState) =>
          !(
            readState.workspaceId === workspaceId &&
            readState.channelId === channelId &&
            readState.userId === memberUserId
          ),
      );

      return { success: true };
    });
  }

  async update(userId: string, workspaceId: string, channelId: string, dto: UpdateChannelDto) {
    await this.workspacesService.assertMembership(userId, workspaceId);

    return this.localStoreService.updateState((state) => {
      const membership = this.getWorkspaceMembershipOrThrow(state, userId, workspaceId);
      const channel = this.getChannelOrThrow(state, workspaceId, channelId);

      if (channel.type === 'PRIVATE' && membership.role === 'MEMBER' && channel.createdById !== userId) {
        throw new ForbiddenException('Only the channel creator, admins, or owners can update this channel.');
      }

      if (dto.name) {
        const normalizedName = slugify(dto.name);

        if (!normalizedName) {
          throw new ConflictException('Channel name must contain letters or numbers.');
        }

        if (
          state.channels.some(
            (candidate) =>
              candidate.workspaceId === workspaceId &&
              candidate.id !== channelId &&
              slugify(candidate.name) === normalizedName,
          )
        ) {
          throw new ConflictException('A channel with that name already exists in this workspace.');
        }

        channel.name = normalizedName;
      }

      if (dto.description !== undefined) {
        channel.description = dto.description?.trim() ?? null;
      }

      channel.updatedAt = new Date().toISOString();

      return this.serializeChannel(state, channel, userId);
    });
  }

  async delete(userId: string, workspaceId: string, channelId: string) {
    await this.workspacesService.assertMembership(userId, workspaceId);

    return this.localStoreService.updateState((state) => {
      const membership = this.getWorkspaceMembershipOrThrow(state, userId, workspaceId);
      const channel = this.getChannelOrThrow(state, workspaceId, channelId);

      if (membership.role === 'MEMBER') {
        throw new ForbiddenException('Only admins and owners can delete channels.');
      }

      if (channel.name === 'general') {
        throw new ForbiddenException('The default general channel cannot be deleted.');
      }

      state.channels = state.channels.filter((candidate) => candidate.id !== channelId);
      state.channelMemberships = state.channelMemberships.filter(
        (membership) => membership.channelId !== channelId,
      );
      state.channelReadStates = state.channelReadStates.filter(
        (readState) => readState.channelId !== channelId,
      );
      state.messages = state.messages.filter(
        (message) => message.channelId !== channelId,
      );

      return { success: true };
    });
  }

  async assertChannelAccess(userId: string, workspaceId: string, channelId: string) {
    const state = await this.localStoreService.readState();
    this.getWorkspaceMembershipOrThrow(state, userId, workspaceId);
    const channel = this.getChannelOrThrow(state, workspaceId, channelId);

    if (channel.type === 'PRIVATE' && !this.isChannelMember(state, channelId, userId)) {
      throw new ForbiddenException('Private channel membership is required.');
    }

    return channel;
  }

  private getChannelOrThrow(state: LocalStoreState, workspaceId: string, channelId: string) {
    const channel = state.channels.find(
      (candidate) => candidate.id === channelId && candidate.workspaceId === workspaceId,
    );

    if (!channel) {
      throw new NotFoundException('Channel not found.');
    }

    return channel;
  }

  private getWorkspaceMembershipOrThrow(state: LocalStoreState, userId: string, workspaceId: string) {
    const membership = state.memberships.find(
      (candidate) => candidate.workspaceId === workspaceId && candidate.userId === userId,
    );

    if (!membership) {
      throw new ForbiddenException('Workspace membership is required.');
    }

    return membership;
  }

  private isChannelMember(state: LocalStoreState, channelId: string, userId: string) {
    return state.channelMemberships.some(
      (membership) => membership.channelId === channelId && membership.userId === userId,
    );
  }

  private assertCanViewChannelMembers(
    state: LocalStoreState,
    actorWorkspaceMembership: LocalWorkspaceMembershipRecord,
    channel: LocalChannelRecord,
    actorUserId: string,
  ) {
    if (channel.type === 'PUBLIC') {
      return;
    }

    if (
      actorWorkspaceMembership.role === 'OWNER' ||
      actorWorkspaceMembership.role === 'ADMIN' ||
      channel.createdById === actorUserId ||
      this.isChannelMember(state, channel.id, actorUserId)
    ) {
      return;
    }

    throw new ForbiddenException('Private channel access is required.');
  }

  private assertCanManageChannelMembers(
    state: LocalStoreState,
    actorWorkspaceMembership: LocalWorkspaceMembershipRecord,
    channel: LocalChannelRecord,
    actorUserId: string,
  ) {
    if (actorWorkspaceMembership.role === 'OWNER' || actorWorkspaceMembership.role === 'ADMIN') {
      return;
    }

    if (channel.type === 'PRIVATE' && channel.createdById === actorUserId && this.isChannelMember(state, channel.id, actorUserId)) {
      return;
    }

    throw new ForbiddenException('Only admins, owners, or the private channel creator can manage channel members.');
  }

  private serializeChannel(
    state: Awaited<ReturnType<LocalStoreService['readState']>>,
    channel: LocalChannelRecord,
    userId: string,
  ) {
    const readState = state.channelReadStates.find(
      (candidate) =>
        candidate.workspaceId === channel.workspaceId &&
        candidate.channelId === channel.id &&
        candidate.userId === userId,
    );

    const unreadCount = state.messages.filter(
      (message) =>
        message.workspaceId === channel.workspaceId &&
        message.channelId === channel.id &&
        message.deletedAt === null &&
        message.senderId !== userId &&
        (!readState || message.createdAt > readState.lastReadAt),
    ).length;

    return {
      id: channel.id,
      workspaceId: channel.workspaceId,
      name: channel.name,
      description: channel.description,
      type: channel.type,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      unreadCount,
      memberCount:
        channel.type === 'PUBLIC'
          ? state.memberships.filter((membership) => membership.workspaceId === channel.workspaceId).length
          : state.channelMemberships.filter((membership) => membership.channelId === channel.id).length,
      isMember: channel.type === 'PUBLIC' ? true : this.isChannelMember(state, channel.id, userId),
    };
  }
}