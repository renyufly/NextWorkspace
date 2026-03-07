import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  LocalChannelReadStateRecord,
  LocalMessageRecord,
  LocalStoreState,
} from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { FilesService } from '../files/files.service.js';
import { JobsService } from '../jobs/jobs.service.js';
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
    private readonly jobsService: JobsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async list(userId: string, workspaceId: string, channelId: string, query: ListMessagesQueryDto) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const state = await this.localStoreService.readState();
    const limit = query.limit ?? 20;

    const sortedMessages = state.messages
      .filter(
        (message) =>
          message.workspaceId === workspaceId &&
          message.channelId === channelId &&
          message.parentMessageId === null,
      )
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
    const parentMessageId = dto.parentMessageId ?? null;

    await this.filesService.assertAttachmentsAvailable(userId, workspaceId, attachmentIds);

    const createdMessage = await this.localStoreService.updateState((state) => {
      const sender = state.users.find((candidate) => candidate.id === userId);

      if (!sender) {
        throw new Error('Sender not found.');
      }

      if (parentMessageId) {
        const parentMessage = this.getMessageOrThrow(state.messages, workspaceId, channelId, parentMessageId);

        if (parentMessage.parentMessageId !== null) {
          throw new ForbiddenException('Nested thread replies are not supported.');
        }
      }

      const message: LocalMessageRecord = {
        id: randomUUID(),
        workspaceId,
        channelId,
        senderId: userId,
        parentMessageId,
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

    await this.jobsService.dispatchMentionNotifications({
      workspaceId,
      channelId,
      messageId: createdMessage.id,
      senderUserId: userId,
      content: dto.content,
    });

    this.realtimeService.emitMessageCreated(channelId, createdMessage);

    return createdMessage;
  }

  async listThread(userId: string, workspaceId: string, channelId: string, messageId: string) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const state = await this.localStoreService.readState();

    this.getMessageOrThrow(state.messages, workspaceId, channelId, messageId);

    return state.messages
      .filter(
        (message) =>
          message.workspaceId === workspaceId &&
          message.channelId === channelId &&
          message.parentMessageId === messageId,
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((message) => this.serializeMessage(state, message, userId));
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

    await this.jobsService.dispatchMentionNotifications({
      workspaceId,
      channelId,
      messageId: updatedMessage.id,
      senderUserId: userId,
      content: dto.content,
    });

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

  async addReaction(userId: string, workspaceId: string, channelId: string, messageId: string, emoji: string) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const normalizedEmoji = emoji.trim();

    const message = await this.localStoreService.updateState((state) => {
      const targetMessage = this.getMessageOrThrow(state.messages, workspaceId, channelId, messageId);

      if (targetMessage.deletedAt) {
        throw new ForbiddenException('Deleted messages cannot receive reactions.');
      }

      const exists = state.messageReactions.some(
        (reaction) =>
          reaction.messageId === messageId && reaction.userId === userId && reaction.emoji === normalizedEmoji,
      );

      if (!exists) {
        state.messageReactions.push({
          id: randomUUID(),
          workspaceId,
          channelId,
          messageId,
          userId,
          emoji: normalizedEmoji,
          createdAt: new Date().toISOString(),
        });
      }

      return this.serializeMessage(state, targetMessage, userId);
    });

    this.realtimeService.emitMessageUpdated(channelId, message);

    return message;
  }

  async removeReaction(userId: string, workspaceId: string, channelId: string, messageId: string, emoji: string) {
    await this.channelsService.assertChannelAccess(userId, workspaceId, channelId);
    const normalizedEmoji = emoji.trim();

    const message = await this.localStoreService.updateState((state) => {
      const targetMessage = this.getMessageOrThrow(state.messages, workspaceId, channelId, messageId);

      state.messageReactions = state.messageReactions.filter(
        (reaction) =>
          !(
            reaction.messageId === messageId &&
            reaction.userId === userId &&
            reaction.emoji === normalizedEmoji
          ),
      );

      return this.serializeMessage(state, targetMessage, userId);
    });

    this.realtimeService.emitMessageUpdated(channelId, message);

    return message;
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

    const channel = state.channels.find((candidate) => candidate.id === message.channelId);
    const threadReplyCount = state.messages.filter((candidate) => candidate.parentMessageId === message.id).length;
    const reactions = Array.from(
      state.messageReactions
        .filter((reaction) => reaction.messageId === message.id)
        .reduce((accumulator, reaction) => {
          const current = accumulator.get(reaction.emoji) ?? {
            emoji: reaction.emoji,
            count: 0,
            reactedByCurrentUser: false,
          };

          current.count += 1;
          current.reactedByCurrentUser ||= reaction.userId === currentUserId;
          accumulator.set(reaction.emoji, current);

          return accumulator;
        }, new Map<string, { emoji: string; count: number; reactedByCurrentUser: boolean }>())
        .values(),
    ).sort((left, right) => left.emoji.localeCompare(right.emoji));

    const eligibleReaders = this.getEligibleReaders(state, channel?.type ?? 'PUBLIC', message.workspaceId, message.channelId);
    const readReceipts = eligibleReaders
      .map((user) => {
        const readState = state.channelReadStates.find(
          (candidate) =>
            candidate.workspaceId === message.workspaceId &&
            candidate.channelId === message.channelId &&
            candidate.userId === user.id &&
            candidate.lastReadAt >= message.createdAt,
        );

        if (!readState) {
          return null;
        }

        return {
          userId: user.id,
          displayName: user.displayName,
          readAt: readState.lastReadAt,
        };
      })
      .filter((receipt): receipt is NonNullable<typeof receipt> => receipt !== null)
      .sort((left, right) => right.readAt.localeCompare(left.readAt));

    return {
      id: message.id,
      workspaceId: message.workspaceId,
      channelId: message.channelId,
      parentMessageId: message.parentMessageId,
      content: message.deletedAt ? 'Message deleted' : message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletedAt: message.deletedAt,
      isDeleted: message.deletedAt !== null,
      isOwnMessage: message.senderId === currentUserId,
      threadReplyCount,
      reactions,
      readReceipts,
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

  private getEligibleReaders(
    state: LocalStoreState,
    channelType: 'PUBLIC' | 'PRIVATE',
    workspaceId: string,
    channelId: string,
  ) {
    if (channelType === 'PRIVATE') {
      return state.channelMemberships
        .filter((membership) => membership.workspaceId === workspaceId && membership.channelId === channelId)
        .map((membership) => state.users.find((candidate) => candidate.id === membership.userId))
        .filter((user): user is NonNullable<typeof user> => user !== undefined);
    }

    return state.memberships
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership) => state.users.find((candidate) => candidate.id === membership.userId))
      .filter((user): user is NonNullable<typeof user> => user !== undefined);
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