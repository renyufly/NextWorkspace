import { ForbiddenException, Injectable } from '@nestjs/common';

import type { WorkspaceAnalyticsSummary } from '@worknext/shared';

import { LocalStoreService } from '../local-store/local-store.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async summary(userId: string, workspaceId: string): Promise<WorkspaceAnalyticsSummary> {
    const membership = await this.workspacesService.assertMembership(userId, workspaceId);

    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Only admins and owners can view workspace analytics.');
    }

    const state = await this.localStoreService.readState();
    const now = new Date();
    const generatedAt = now.toISOString();
    const cutoff7d = this.getCutoff(now, 7);
    const cutoff30d = this.getCutoff(now, 30);
    const workspaceMembers = state.memberships.filter((candidate) => candidate.workspaceId === workspaceId);
    const workspaceChannels = state.channels.filter((candidate) => candidate.workspaceId === workspaceId);
    const workspaceMessages = state.messages.filter((candidate) => candidate.workspaceId === workspaceId);
    const workspaceFiles = state.attachments.filter((candidate) => candidate.workspaceId === workspaceId);
    const workspaceAuditLogs = state.auditLogs.filter((candidate) => candidate.workspaceId === workspaceId);
    const recentMessages7d = workspaceMessages.filter((message) => this.isWithinWindow(message.createdAt, cutoff7d));
    const recentMessages30d = workspaceMessages.filter((message) => this.isWithinWindow(message.createdAt, cutoff30d));
    const recentFiles30d = workspaceFiles.filter((file) => this.isWithinWindow(file.createdAt, cutoff30d));
    const recentAudit30d = workspaceAuditLogs.filter((log) => this.isWithinWindow(log.createdAt, cutoff30d));
    const activeMembers7d = this.countActiveMembers(state, workspaceId, cutoff7d);
    const activeMembers30d = this.countActiveMembers(state, workspaceId, cutoff30d);
    const newMembers7d = workspaceMembers.filter((member) => this.isWithinWindow(member.joinedAt, cutoff7d)).length;
    const newMembers30d = workspaceMembers.filter((member) => this.isWithinWindow(member.joinedAt, cutoff30d)).length;
    const totalMemberCount = workspaceMembers.length;

    return {
      workspaceId,
      generatedAt,
      totals: {
        members: totalMemberCount,
        channels: workspaceChannels.length,
        messages: workspaceMessages.length,
        files: workspaceFiles.length,
        auditEvents: workspaceAuditLogs.length,
      },
      activity: {
        activeMembers7d,
        activeMembers30d,
        messages7d: recentMessages7d.length,
        messages30d: recentMessages30d.length,
        files30d: recentFiles30d.length,
        auditEvents30d: recentAudit30d.length,
      },
      retention: {
        newMembers7d,
        newMembers30d,
        engagedMemberRate7d: this.toPercent(activeMembers7d, totalMemberCount),
        engagedMemberRate30d: this.toPercent(activeMembers30d, totalMemberCount),
      },
      adminActivity: {
        memberChanges30d: recentAudit30d.filter((log) => log.entityType === 'WORKSPACE_MEMBER').length,
        invitationChanges30d: recentAudit30d.filter((log) => log.entityType === 'INVITATION').length,
        channelChanges30d: recentAudit30d.filter((log) => log.entityType === 'CHANNEL' || log.entityType === 'CHANNEL_MEMBER').length,
      },
      messageVolume: this.buildMessageVolume(recentMessages30d, now),
      topChannels: workspaceChannels
        .map((channel) => ({
          channelId: channel.id,
          channelName: channel.name,
          messageCount: recentMessages30d.filter((message) => message.channelId === channel.id).length,
        }))
        .sort((left, right) => right.messageCount - left.messageCount || left.channelName.localeCompare(right.channelName))
        .slice(0, 5),
    };
  }

  private countActiveMembers(
    state: Awaited<ReturnType<LocalStoreService['readState']>>,
    workspaceId: string,
    cutoff: Date,
  ) {
    const activeUserIds = new Set<string>();

    for (const message of state.messages) {
      if (message.workspaceId === workspaceId && this.isWithinWindow(message.createdAt, cutoff)) {
        activeUserIds.add(message.senderId);
      }
    }

    for (const readState of state.channelReadStates) {
      if (readState.workspaceId === workspaceId && this.isWithinWindow(readState.updatedAt, cutoff)) {
        activeUserIds.add(readState.userId);
      }
    }

    for (const reaction of state.messageReactions) {
      if (reaction.workspaceId === workspaceId && this.isWithinWindow(reaction.createdAt, cutoff)) {
        activeUserIds.add(reaction.userId);
      }
    }

    return activeUserIds.size;
  }

  private buildMessageVolume(
    messages: Array<{ createdAt: string }>,
    now: Date,
  ) {
    const volume = new Map<string, number>();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const key = this.toDateKey(new Date(now.getTime() - offset * DAY_IN_MS));
      volume.set(key, 0);
    }

    for (const message of messages) {
      const key = this.toDateKey(new Date(message.createdAt));

      if (volume.has(key)) {
        volume.set(key, (volume.get(key) ?? 0) + 1);
      }
    }

    return Array.from(volume.entries()).map(([date, count]) => ({ date, count }));
  }

  private getCutoff(now: Date, days: number) {
    return new Date(now.getTime() - days * DAY_IN_MS);
  }

  private isWithinWindow(value: string, cutoff: Date) {
    return new Date(value).getTime() >= cutoff.getTime();
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toPercent(numerator: number, denominator: number) {
    if (denominator === 0) {
      return 0;
    }

    return Math.round((numerator / denominator) * 100);
  }
}