import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { slugify } from '../../common/slugify.js';
import type { LocalNotificationRecord } from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async list(userId: string, workspaceId?: string) {
    const state = await this.localStoreService.readState();

    if (workspaceId) {
      await this.workspacesService.assertMembership(userId, workspaceId);
    }

    return state.notifications
      .filter(
        (notification) =>
          notification.userId === userId && (!workspaceId || notification.workspaceId === workspaceId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((notification) => this.serializeNotification(notification));
  }

  async markRead(userId: string, notificationId: string) {
    return this.localStoreService.updateState((state) => {
      const notification = state.notifications.find(
        (candidate) => candidate.id === notificationId && candidate.userId === userId,
      );

      if (notification) {
        notification.readAt = notification.readAt ?? new Date().toISOString();
      }

      return { success: true };
    });
  }

  async markAllRead(userId: string, workspaceId?: string) {
    return this.localStoreService.updateState((state) => {
      const now = new Date().toISOString();

      for (const notification of state.notifications) {
        if (notification.userId !== userId) {
          continue;
        }

        if (workspaceId && notification.workspaceId !== workspaceId) {
          continue;
        }

        notification.readAt = notification.readAt ?? now;
      }

      return { success: true };
    });
  }

  async unreadCount(userId: string, workspaceId?: string) {
    const state = await this.localStoreService.readState();

    const userNotifications = state.notifications.filter(
      (notification) =>
        notification.userId === userId &&
        notification.readAt === null &&
        (!workspaceId || notification.workspaceId === workspaceId),
    );

    const byWorkspace: Record<string, number> = {};

    for (const notification of userNotifications) {
      byWorkspace[notification.workspaceId] = (byWorkspace[notification.workspaceId] ?? 0) + 1;
    }

    return {
      total: userNotifications.length,
      workspaces: byWorkspace,
    };
  }

  async createMentionNotifications(
    workspaceId: string,
    channelId: string,
    messageId: string,
    senderUserId: string,
    content: string,
  ) {
    const mentionKeys = [
      ...new Set(
        Array.from(content.matchAll(/@([a-zA-Z0-9._-]+)/g))
          .map((match) => match[1]?.toLowerCase() ?? '')
          .filter((value) => value.length > 0),
      ),
    ];

    if (mentionKeys.length === 0) {
      return;
    }

    await this.localStoreService.updateState((state) => {
      const workspaceMembers = state.memberships.filter((membership) => membership.workspaceId === workspaceId);
      const candidates = state.users.filter((user) => workspaceMembers.some((membership) => membership.userId === user.id));
      const sender = state.users.find((user) => user.id === senderUserId);
      const now = new Date().toISOString();

      for (const user of candidates) {
        if (user.id === senderUserId) {
          continue;
        }

        const emailAlias = user.email.split('@')[0]?.toLowerCase() ?? '';
        const displayAlias = slugify(user.displayName).replace(/-/g, '');
        const matched = mentionKeys.some((key) => key === emailAlias || key === displayAlias);

        if (!matched) {
          continue;
        }

        const exists = state.notifications.some(
          (notification) =>
            notification.userId === user.id &&
            notification.messageId === messageId &&
            notification.type === 'MENTION',
        );

        if (exists) {
          continue;
        }

        state.notifications.push({
          id: randomUUID(),
          workspaceId,
          userId: user.id,
          type: 'MENTION',
          title: `${sender?.displayName ?? 'Someone'} mentioned you`,
          body: content.slice(0, 160),
          channelId,
          messageId,
          readAt: null,
          createdAt: now,
        });

        this.realtimeService.emitNotification(workspaceId, user.id, {
          type: 'MENTION',
          title: `${sender?.displayName ?? 'Someone'} mentioned you`,
          channelId,
          messageId,
        });
      }
    });
  }

  private serializeNotification(notification: LocalNotificationRecord) {
    return {
      id: notification.id,
      workspaceId: notification.workspaceId,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      channelId: notification.channelId,
      messageId: notification.messageId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}