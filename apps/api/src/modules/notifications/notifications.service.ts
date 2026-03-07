import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { DigestRunSummary } from '@worknext/shared';

import { slugify } from '../../common/slugify.js';
import { EmailService } from '../email/email.service.js';
import type { LocalNotificationPreferenceRecord, LocalNotificationRecord } from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { PushService } from '../push/push.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto.js';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
    private readonly realtimeService: RealtimeService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
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

  async getPreferences(userId: string, workspaceId: string) {
    await this.workspacesService.assertMembership(userId, workspaceId);
    const state = await this.localStoreService.readState();

    return this.getOrCreatePreference(state, userId, workspaceId);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    await this.workspacesService.assertMembership(userId, dto.workspaceId);

    return this.localStoreService.updateState((state) => {
      const preference = this.getOrCreatePreference(state, userId, dto.workspaceId);
      const now = new Date().toISOString();

      if (dto.muteAll !== undefined) {
        preference.muteAll = dto.muteAll;
      }

      if (dto.allowMentions !== undefined) {
        preference.allowMentions = dto.allowMentions;
      }

      if (dto.emailMentions !== undefined) {
        preference.emailMentions = dto.emailMentions;
      }

      if (dto.emailDigest !== undefined) {
        preference.emailDigest = dto.emailDigest;
      }

      if (dto.pushMentions !== undefined) {
        preference.pushMentions = dto.pushMentions;
      }

      if (dto.pushDigest !== undefined) {
        preference.pushDigest = dto.pushDigest;
      }

      if (dto.mutedChannelIds !== undefined) {
        preference.mutedChannelIds = dto.mutedChannelIds;
      }

      if (dto.digestMode !== undefined) {
        preference.digestMode = dto.digestMode;
      }

      preference.updatedAt = now;

      return preference;
    });
  }

  async runDigest(userId: string, workspaceId: string): Promise<DigestRunSummary> {
    await this.workspacesService.assertMembership(userId, workspaceId);

    const result = await this.localStoreService.updateState((state) => {
      const created = this.createDigestNotification(state, userId, workspaceId, new Date().toISOString());

      return {
        created,
      };
    });

    if (result.created?.email) {
      await this.emailService.send({
        to: result.created.email.to,
        subject: result.created.email.subject,
        text: result.created.email.text,
        category: 'DIGEST',
        workspaceId,
        userId,
      });
    }

    if (result.created?.push) {
      await this.pushService.send({
        userId,
        workspaceId,
        category: 'DIGEST',
        title: result.created.push.title,
        body: result.created.push.body,
      });
    }

    return {
      queued: false,
      createdCount: result.created ? 1 : 0,
      notification: result.created ? this.serializeNotification(result.created.notification) : null,
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

    const deliveries = await this.localStoreService.updateState((state) => {
      const workspaceMembers = state.memberships.filter((membership) => membership.workspaceId === workspaceId);
      const candidates = state.users.filter((user) => workspaceMembers.some((membership) => membership.userId === user.id));
      const sender = state.users.find((user) => user.id === senderUserId);
      const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
      const channel = state.channels.find((candidate) => candidate.id === channelId);
      const now = new Date().toISOString();
      const nextDeliveries: Array<{
        email: { to: string; subject: string; text: string } | null;
        push: { title: string; body: string } | null;
        userId: string;
      }> = [];

      for (const user of candidates) {
        if (user.id === senderUserId) {
          continue;
        }

        const preference = this.getOrCreatePreference(state, user.id, workspaceId);

        if (preference.muteAll || !preference.allowMentions || preference.mutedChannelIds.includes(channelId)) {
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

        if (preference.emailMentions) {
          nextDeliveries.push({
            userId: user.id,
            email: {
              to: user.email,
              subject: `[WorkNext] ${sender?.displayName ?? 'Someone'} mentioned you in ${workspace?.name ?? 'a workspace'}`,
              text: [
                `Workspace: ${workspace?.name ?? 'WorkNext'}`,
                `Channel: #${channel?.name ?? 'channel'}`,
                `From: ${sender?.displayName ?? 'Someone'}`,
                '',
                content.trim(),
              ].join('\n'),
            },
            push: preference.pushMentions
              ? {
                  title: `${sender?.displayName ?? 'Someone'} mentioned you`,
                  body: `#${channel?.name ?? 'channel'} · ${content.trim().slice(0, 120)}`,
                }
              : null,
          });
        } else if (preference.pushMentions) {
          nextDeliveries.push({
            userId: user.id,
            email: null,
            push: {
              title: `${sender?.displayName ?? 'Someone'} mentioned you`,
              body: `#${channel?.name ?? 'channel'} · ${content.trim().slice(0, 120)}`,
            },
          });
        }
      }

      return nextDeliveries;
    });

    await Promise.all(
      deliveries.flatMap((delivery) => {
        const tasks: Promise<unknown>[] = [];

        if (delivery.email) {
          tasks.push(
            this.emailService.send({
              to: delivery.email.to,
              subject: delivery.email.subject,
              text: delivery.email.text,
              category: 'MENTION',
              workspaceId,
              userId: delivery.userId,
            }),
          );
        }

        if (delivery.push) {
          tasks.push(
            this.pushService.send({
              userId: delivery.userId,
              workspaceId,
              category: 'MENTION',
              title: delivery.push.title,
              body: delivery.push.body,
            }),
          );
        }

        return tasks;
      }),
    );
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

  private createDigestNotification(
    state: Awaited<ReturnType<LocalStoreService['readState']>>,
    userId: string,
    workspaceId: string,
    now: string,
  ) {
    const preference = this.getOrCreatePreference(state, userId, workspaceId);
    const recipient = state.users.find((candidate) => candidate.id === userId);
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    const lastDigestAt = preference.lastDigestAt;
    const unreadMentions = state.notifications
      .filter(
        (notification) =>
          notification.userId === userId &&
          notification.workspaceId === workspaceId &&
          notification.type === 'MENTION' &&
          notification.readAt === null &&
          (!lastDigestAt || notification.createdAt > lastDigestAt),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    if (unreadMentions.length === 0) {
      preference.lastDigestAt = now;
      preference.updatedAt = now;
      return null;
    }

    const [latestNotification] = unreadMentions;

    if (!latestNotification) {
      return null;
    }

    const digestNotification: LocalNotificationRecord = {
      id: randomUUID(),
      workspaceId,
      userId,
      type: 'DIGEST',
      title: `Daily digest · ${unreadMentions.length} unread mention${unreadMentions.length === 1 ? '' : 's'}`,
      body: unreadMentions
        .slice(0, 3)
        .map((notification) => notification.title)
        .join(' · '),
      channelId: latestNotification.channelId,
      messageId: latestNotification.messageId,
      readAt: null,
      createdAt: now,
    };

    state.notifications.push(digestNotification);
    preference.lastDigestAt = now;
    preference.updatedAt = now;

    this.realtimeService.emitNotification(workspaceId, userId, {
      type: 'DIGEST',
      title: digestNotification.title,
      channelId: digestNotification.channelId,
      messageId: digestNotification.messageId,
    });

    return {
      notification: digestNotification,
      email:
        preference.emailDigest && recipient
          ? {
              to: recipient.email,
              subject: `[WorkNext] ${digestNotification.title}`,
              text: [
                `Workspace: ${workspace?.name ?? 'WorkNext'}`,
                '',
                digestNotification.body,
              ].join('\n'),
            }
          : null,
      push: preference.pushDigest
        ? {
            title: digestNotification.title,
            body: digestNotification.body,
          }
        : null,
    };
  }

  private getOrCreatePreference(
    state: Awaited<ReturnType<LocalStoreService['readState']>>,
    userId: string,
    workspaceId: string,
  ): LocalNotificationPreferenceRecord {
    const existing = state.notificationPreferences.find(
      (candidate) => candidate.userId === userId && candidate.workspaceId === workspaceId,
    );

    if (existing) {
      existing.emailMentions = existing.emailMentions ?? false;
      existing.emailDigest = existing.emailDigest ?? false;
      existing.pushMentions = existing.pushMentions ?? false;
      existing.pushDigest = existing.pushDigest ?? false;
      return existing;
    }

    const now = new Date().toISOString();
    const created: LocalNotificationPreferenceRecord = {
      id: randomUUID(),
      workspaceId,
      userId,
      muteAll: false,
      allowMentions: true,
      emailMentions: false,
      emailDigest: false,
      pushMentions: false,
      pushDigest: false,
      mutedChannelIds: [],
      digestMode: 'OFF',
      lastDigestAt: null,
      createdAt: now,
      updatedAt: now,
    };

    state.notificationPreferences.push(created);
    return created;
  }
}