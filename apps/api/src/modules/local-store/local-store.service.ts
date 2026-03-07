import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service.js';
import { createEmptyState, type LocalStoreState } from './local-store.types.js';

type DatabaseClient = PrismaService | Prisma.TransactionClient;
const APP_STATE_META_ID = 'worknext-state';

@Injectable()
export class LocalStoreService {
  private readonly stateFilePath: string;
  private readonly storageDriver: 'local' | 'database';
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const configuredPath = this.configService.get<string>('LOCAL_DATA_FILE', '.data/worknext.json');
    this.stateFilePath = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
    this.storageDriver = this.configService.get<'local' | 'database'>('STORAGE_DRIVER', 'local');
  }

  getStateFilePath(): string {
    return this.storageDriver === 'database' ? 'postgresql' : this.stateFilePath;
  }

  async readState(): Promise<LocalStoreState> {
    if (this.storageDriver === 'database') {
      return this.prismaService.$transaction((transaction) => this.readDatabaseState(transaction, true));
    }

    await this.ensureStateFile();
    const rawState = await readFile(this.stateFilePath, 'utf8');

    return this.normalizeState(JSON.parse(rawState) as Partial<LocalStoreState>);
  }

  async updateState<T>(updater: (state: LocalStoreState) => Promise<T> | T): Promise<T> {
    if (this.storageDriver === 'database') {
      const operation = this.writeChain.then(() =>
        this.prismaService.$transaction(async (transaction) => {
          const state = await this.readDatabaseState(transaction, true);
          const result = await updater(state);
          state.meta.updatedAt = new Date().toISOString();
          await this.persistDatabaseState(transaction, state);

          return result;
        }),
      );

      this.writeChain = operation.then(
        () => undefined,
        () => undefined,
      );

      return operation;
    }

    const operation = this.writeChain.then(async () => {
      const state = await this.readState();
      const result = await updater(state);
      state.meta.updatedAt = new Date().toISOString();
      await this.persistState(state);

      return result;
    });

    this.writeChain = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }

  private async ensureStateFile() {
    try {
      await readFile(this.stateFilePath, 'utf8');
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code !== 'ENOENT') {
        throw error;
      }

      await mkdir(dirname(this.stateFilePath), { recursive: true });
      await this.persistState(createEmptyState());
    }
  }

  private async persistState(state: LocalStoreState) {
    await mkdir(dirname(this.stateFilePath), { recursive: true });

    const tempFilePath = `${this.stateFilePath}.tmp`;
    await writeFile(tempFilePath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempFilePath, this.stateFilePath);
  }

  private normalizeState(rawState: Partial<LocalStoreState>): LocalStoreState {
    const emptyState = createEmptyState();

    return {
      meta: {
        version: rawState.meta?.version ?? emptyState.meta.version,
        createdAt: rawState.meta?.createdAt ?? emptyState.meta.createdAt,
        updatedAt: rawState.meta?.updatedAt ?? emptyState.meta.updatedAt,
      },
      users: rawState.users ?? emptyState.users,
      sessions: rawState.sessions ?? emptyState.sessions,
      workspaces: rawState.workspaces ?? emptyState.workspaces,
      memberships: rawState.memberships ?? emptyState.memberships,
      invitations: rawState.invitations ?? emptyState.invitations,
      channels: rawState.channels ?? emptyState.channels,
      channelMemberships: rawState.channelMemberships ?? emptyState.channelMemberships,
      channelReadStates: rawState.channelReadStates ?? emptyState.channelReadStates,
      attachments: rawState.attachments ?? emptyState.attachments,
      notifications: rawState.notifications ?? emptyState.notifications,
      messages: rawState.messages ?? emptyState.messages,
    };
  }

  private async readDatabaseState(
    client: DatabaseClient,
    bootstrapIfNeeded: boolean,
  ): Promise<LocalStoreState> {
    if (bootstrapIfNeeded) {
      await this.bootstrapDatabaseState(client);
    }

    const [
      meta,
      users,
      sessions,
      workspaces,
      memberships,
      invitations,
      channels,
      channelMemberships,
      channelReadStates,
      attachments,
      notifications,
      messages,
    ] = await Promise.all([
      client.appStateMeta.findUnique({ where: { id: APP_STATE_META_ID } }),
      client.user.findMany(),
      client.session.findMany(),
      client.workspace.findMany(),
      client.workspaceMembership.findMany(),
      client.invitation.findMany(),
      client.channel.findMany(),
      client.channelMembership.findMany(),
      client.channelReadState.findMany(),
      client.fileAttachment.findMany(),
      client.notification.findMany(),
      client.message.findMany(),
    ]);

    const emptyState = createEmptyState();

    return {
      meta: meta
        ? {
            version: meta.version,
            createdAt: meta.createdAt.toISOString(),
            updatedAt: meta.updatedAt.toISOString(),
          }
        : emptyState.meta,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      sessions: sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdById: workspace.createdById,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      })),
      memberships: memberships.map((membership) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
      })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        email: invitation.email,
        token: invitation.token,
        role: invitation.role,
        invitedById: invitation.invitedById,
        expiresAt: invitation.expiresAt.toISOString(),
        acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
        createdAt: invitation.createdAt.toISOString(),
        updatedAt: invitation.updatedAt.toISOString(),
      })),
      channels: channels.map((channel) => ({
        id: channel.id,
        workspaceId: channel.workspaceId,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        createdById: channel.createdById,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      })),
      channelMemberships: channelMemberships.map((membership) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        channelId: membership.channelId,
        userId: membership.userId,
        addedById: membership.addedById,
        joinedAt: membership.joinedAt.toISOString(),
      })),
      channelReadStates: channelReadStates.map((readState) => ({
        id: readState.id,
        workspaceId: readState.workspaceId,
        channelId: readState.channelId,
        userId: readState.userId,
        lastReadAt: readState.lastReadAt.toISOString(),
        updatedAt: readState.updatedAt.toISOString(),
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        workspaceId: attachment.workspaceId,
        uploaderId: attachment.uploaderId,
        messageId: attachment.messageId,
        storageKey: attachment.storageKey,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
        createdAt: attachment.createdAt.toISOString(),
      })),
      notifications: notifications.map((notification) => ({
        id: notification.id,
        workspaceId: notification.workspaceId,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        channelId: notification.channelId,
        messageId: notification.messageId,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      })),
      messages: messages.map((message) => ({
        id: message.id,
        workspaceId: message.workspaceId,
        channelId: message.channelId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        deletedAt: message.deletedAt?.toISOString() ?? null,
      })),
    };
  }

  private async bootstrapDatabaseState(client: DatabaseClient) {
    const [meta, hasUsers, hasWorkspaces] = await Promise.all([
      client.appStateMeta.findUnique({ where: { id: APP_STATE_META_ID } }),
      client.user.count(),
      client.workspace.count(),
    ]);

    if (meta || hasUsers > 0 || hasWorkspaces > 0) {
      return;
    }

    const bootstrapState = await this.readBootstrapStateFromDisk();
    await this.persistDatabaseState(client, bootstrapState ?? createEmptyState());
  }

  private async readBootstrapStateFromDisk() {
    try {
      const rawState = await readFile(this.stateFilePath, 'utf8');

      return this.normalizeState(JSON.parse(rawState) as Partial<LocalStoreState>);
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  private async persistDatabaseState(client: DatabaseClient, state: LocalStoreState) {
    await client.notification.deleteMany();
    await client.fileAttachment.deleteMany();
    await client.channelReadState.deleteMany();
    await client.channelMembership.deleteMany();
    await client.message.deleteMany();
    await client.invitation.deleteMany();
    await client.workspaceMembership.deleteMany();
    await client.channel.deleteMany();
    await client.session.deleteMany();
    await client.presence.deleteMany();
    await client.workspace.deleteMany();
    await client.user.deleteMany();
    await client.appStateMeta.deleteMany();

    await client.appStateMeta.create({
      data: {
        id: APP_STATE_META_ID,
        version: state.meta.version,
        createdAt: new Date(state.meta.createdAt),
        updatedAt: new Date(state.meta.updatedAt),
      },
    });

    if (state.users.length > 0) {
      await client.user.createMany({
        data: state.users.map((user) => ({
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          displayName: user.displayName,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        })),
      });
    }

    if (state.workspaces.length > 0) {
      await client.workspace.createMany({
        data: state.workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          createdById: workspace.createdById,
          createdAt: new Date(workspace.createdAt),
          updatedAt: new Date(workspace.updatedAt),
        })),
      });
    }

    if (state.sessions.length > 0) {
      await client.session.createMany({
        data: state.sessions.map((session) => ({
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          expiresAt: new Date(session.expiresAt),
          revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
        })),
      });
    }

    if (state.memberships.length > 0) {
      await client.workspaceMembership.createMany({
        data: state.memberships.map((membership) => ({
          id: membership.id,
          workspaceId: membership.workspaceId,
          userId: membership.userId,
          role: membership.role,
          joinedAt: new Date(membership.joinedAt),
        })),
      });
    }

    if (state.invitations.length > 0) {
      await client.invitation.createMany({
        data: state.invitations.map((invitation) => ({
          id: invitation.id,
          workspaceId: invitation.workspaceId,
          email: invitation.email,
          token: invitation.token,
          role: invitation.role,
          invitedById: invitation.invitedById,
          expiresAt: new Date(invitation.expiresAt),
          acceptedAt: invitation.acceptedAt ? new Date(invitation.acceptedAt) : null,
          createdAt: new Date(invitation.createdAt),
          updatedAt: new Date(invitation.updatedAt),
        })),
      });
    }

    if (state.channels.length > 0) {
      await client.channel.createMany({
        data: state.channels.map((channel) => ({
          id: channel.id,
          workspaceId: channel.workspaceId,
          name: channel.name,
          description: channel.description,
          type: channel.type,
          createdById: channel.createdById,
          createdAt: new Date(channel.createdAt),
          updatedAt: new Date(channel.updatedAt),
        })),
      });
    }

    if (state.channelMemberships.length > 0) {
      await client.channelMembership.createMany({
        data: state.channelMemberships.map((membership) => ({
          id: membership.id,
          workspaceId: membership.workspaceId,
          channelId: membership.channelId,
          userId: membership.userId,
          addedById: membership.addedById,
          joinedAt: new Date(membership.joinedAt),
        })),
      });
    }

    if (state.channelReadStates.length > 0) {
      await client.channelReadState.createMany({
        data: state.channelReadStates.map((readState) => ({
          id: readState.id,
          workspaceId: readState.workspaceId,
          channelId: readState.channelId,
          userId: readState.userId,
          lastReadAt: new Date(readState.lastReadAt),
          updatedAt: new Date(readState.updatedAt),
        })),
      });
    }

    if (state.messages.length > 0) {
      await client.message.createMany({
        data: state.messages.map((message) => ({
          id: message.id,
          workspaceId: message.workspaceId,
          channelId: message.channelId,
          senderId: message.senderId,
          content: message.content,
          createdAt: new Date(message.createdAt),
          updatedAt: new Date(message.updatedAt),
          deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
        })),
      });
    }

    if (state.attachments.length > 0) {
      await client.fileAttachment.createMany({
        data: state.attachments.map((attachment) => ({
          id: attachment.id,
          workspaceId: attachment.workspaceId,
          uploaderId: attachment.uploaderId,
          messageId: attachment.messageId,
          storageKey: attachment.storageKey,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          url: attachment.url,
          createdAt: new Date(attachment.createdAt),
        })),
      });
    }

    if (state.notifications.length > 0) {
      await client.notification.createMany({
        data: state.notifications.map((notification) => ({
          id: notification.id,
          workspaceId: notification.workspaceId,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          channelId: notification.channelId,
          messageId: notification.messageId,
          readAt: notification.readAt ? new Date(notification.readAt) : null,
          createdAt: new Date(notification.createdAt),
        })),
      });
    }
  }
}