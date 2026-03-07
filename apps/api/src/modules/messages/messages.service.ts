import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  LocalChannelReadStateRecord,
  LocalMessageRecord,
} from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { FilesService } from '../files/files.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly channelsService: ChannelsService,
    private readonly filesService: FilesService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async list(userId: string, workspaceId: string, channelId: string, query: ListMessagesQueryDto) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const state = await this.localStoreService.readState();
    const limit = query.limit ?? 20;

    const sortedMessages = state.messages
      .filter((message) => message.workspaceId === workspaceId && message.channelId === channelId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const startIndex = query.cursor
      ? sortedMessages.findIndex((message) => message.id === query.cursor) + 1
      : 0;

    const pagedMessages = sortedMessages.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < sortedMessages.length && pagedMessages.length > 0
        ? pagedMessages[pagedMessages.length - 1]?.id ?? null
        : null;

    return {
      items: [...pagedMessages].reverse().map((message) => this.serializeMessage(state, message, userId)),
      nextCursor,
    };
  }

  async send(userId: string, workspaceId: string, channelId: string, dto: SendMessageDto) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const now = new Date().toISOString();
    const attachmentIds = dto.attachmentIds ?? [];

    await this.filesService.assertAttachmentsAvailable(userId, workspaceId, attachmentIds);

    const createdMessage = await this.localStoreService.updateState((state) => {
      const sender = state.users.find((candidate) => candidate.id === userId);

      if (!sender) {
        throw new Error('Sender not found.');
      }

      const message: LocalMessageRecord = {
        id: randomUUID(),
        workspaceId,
        channelId,
        senderId: userId,
        content: dto.content.trim(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      state.messages.push(message);
      for (const attachmentId of attachmentIds) {
        const attachment = state.attachments.find(
          (candidate) => candidate.id === attachmentId && candidate.workspaceId === workspaceId,
        );

        if (attachment) {
          attachment.messageId = message.id;
        }
      }
      this.upsertReadState(state.channelReadStates, userId, workspaceId, channelId, now);

      return this.serializeMessage(state, message, userId);
    });

    await this.notificationsService.createMentionNotifications(
      workspaceId,
      channelId,
      createdMessage.id,
      userId,
      dto.content,
    );

    this.realtimeService.emitMessageCreated(channelId, createdMessage);

    return createdMessage;
  }

  async update(
    userId: string,
    workspaceId: string,
    channelId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const now = new Date().toISOString();

    const updatedMessage = await this.localStoreService.updateState((state) => {
      const message = this.getMessageOrThrow(state.messages, workspaceId, channelId, messageId);

      if (message.senderId !== userId) {
        throw new ForbiddenException('Only the message author can edit this message.');
      }

      if (message.deletedAt !== null) {
        throw new ForbiddenException('Deleted messages cannot be edited.');
      }

      message.content = dto.content.trim();
      message.updatedAt = now;

      return this.serializeMessage(state, message, userId);
    });

    await this.notificationsService.createMentionNotifications(
      workspaceId,
      channelId,
      updatedMessage.id,
      userId,
      dto.content,
    );

    this.realtimeService.emitMessageUpdated(channelId, updatedMessage);

    return updatedMessage;
  }

  async softDelete(userId: string, workspaceId: string, channelId: string, messageId: string) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const now = new Date().toISOString();

    const deletedMessage = await this.localStoreService.updateState((state) => {
      const message = this.getMessageOrThrow(state.messages, workspaceId, channelId, messageId);

      if (message.senderId !== userId) {
        throw new ForbiddenException('Only the message author can delete this message.');
      }

      message.deletedAt = now;
      message.updatedAt = now;

      return this.serializeMessage(state, message, userId);
    });

    this.realtimeService.emitMessageDeleted(channelId, deletedMessage);

    return deletedMessage;
  }

  async markRead(userId: string, workspaceId: string, channelId: string) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);

    await this.localStoreService.updateState((state) => {
      this.upsertReadState(state.channelReadStates, userId, workspaceId, channelId, new Date().toISOString());
    });

    return { success: true };
  }

  private serializeMessage(
    state: Awaited<ReturnType<LocalStoreService['readState']>>,
    message: LocalMessageRecord,
    currentUserId: string,
  ) {
    const sender = state.users.find((candidate) => candidate.id === message.senderId);

    return {
      id: message.id,
      workspaceId: message.workspaceId,
      channelId: message.channelId,
      content: message.deletedAt ? 'Message deleted' : message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletedAt: message.deletedAt,
      isDeleted: message.deletedAt !== null,
      isOwnMessage: message.senderId === currentUserId,
      attachments: state.attachments
        .filter((attachment) => attachment.messageId === message.id)
        .map((attachment) => ({
          id: attachment.id,
          workspaceId: attachment.workspaceId,
          messageId: attachment.messageId,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          url: attachment.url,
          createdAt: attachment.createdAt,
        })),
      sender: sender
        ? {
            id: sender.id,
            displayName: sender.displayName,
          }
        : {
            id: message.senderId,
            displayName: 'Unknown user',
          },
    };
  }

  private getMessageOrThrow(
    messages: LocalMessageRecord[],
    workspaceId: string,
    channelId: string,
    messageId: string,
  ) {
    const message = messages.find(
      (candidate) =>
        candidate.id === messageId &&
        candidate.workspaceId === workspaceId &&
        candidate.channelId === channelId,
    );

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    return message;
  }

  private upsertReadState(
    channelReadStates: LocalChannelReadStateRecord[],
    userId: string,
    workspaceId: string,
    channelId: string,
    timestamp: string,
  ) {
    const readState = channelReadStates.find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.workspaceId === workspaceId &&
        candidate.channelId === channelId,
    );

    if (readState) {
      readState.lastReadAt = timestamp;
      readState.updatedAt = timestamp;
      return;
    }

    channelReadStates.push({
      id: randomUUID(),
      userId,
      workspaceId,
      channelId,
      lastReadAt: timestamp,
      updatedAt: timestamp,
    });
  }
}