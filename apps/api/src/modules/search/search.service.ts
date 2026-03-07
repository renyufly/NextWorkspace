import { ForbiddenException, Injectable } from '@nestjs/common';

import type { WorkspaceSearchScope } from '@worknext/shared';

import { LocalStoreService } from '../local-store/local-store.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { SearchWorkspaceQueryDto } from './dto/search-workspace-query.dto.js';

type SearchCandidate<T> = T & {
  score: number;
};

@Injectable()
export class SearchService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async search(userId: string, workspaceId: string, query: SearchWorkspaceQueryDto) {
    await this.workspacesService.assertMembership(userId, workspaceId);
    const state = await this.localStoreService.readState();
    const rawQuery = query.q?.trim() ?? '';
    const scope = query.scope ?? 'ALL';
    const limit = query.limit ?? 8;
    const terms = this.tokenize(rawQuery);

    if (terms.length === 0) {
      return {
        query: rawQuery,
        scope,
        appliedChannelId: query.channelId ?? null,
        totalCount: 0,
        channels: [],
        messages: [],
        files: [],
        members: [],
      };
    }

    const accessibleChannelIds = new Set(
      state.channels
        .filter(
          (channel) =>
            channel.workspaceId === workspaceId &&
            (channel.type === 'PUBLIC' ||
              state.channelMemberships.some(
                (membership) => membership.channelId === channel.id && membership.userId === userId,
              )),
        )
        .map((channel) => channel.id),
    );

    if (query.channelId && !accessibleChannelIds.has(query.channelId)) {
      throw new ForbiddenException('Channel access is required for filtered search.');
    }

    const filteredChannelIds = query.channelId ? new Set([query.channelId]) : accessibleChannelIds;

    const channels = scope === 'ALL' || scope === 'CHANNELS'
      ? state.channels
          .filter((channel) => accessibleChannelIds.has(channel.id))
          .map((channel) => {
            const matchedFields = [
              ...(this.matchesAllTerms(channel.name, terms) ? ['name'] : []),
              ...(channel.description && this.matchesAllTerms(channel.description, terms) ? ['description'] : []),
            ];

            if (matchedFields.length === 0) {
              return null;
            }

            return {
              id: channel.id,
              name: channel.name,
              description: channel.description,
              type: channel.type,
              matchedFields,
              score:
                this.scoreField(channel.name, terms, { exact: 120, prefix: 80, includes: 40 }) +
                this.scoreField(channel.description ?? '', terms, { exact: 60, prefix: 30, includes: 18 }),
            };
          })
          .filter((channel): channel is NonNullable<typeof channel> => channel !== null)
          .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
          .slice(0, limit)
      : [];

    const messages = scope === 'ALL' || scope === 'MESSAGES'
      ? state.messages
          .filter(
            (message) =>
              message.workspaceId === workspaceId &&
              filteredChannelIds.has(message.channelId) &&
              message.deletedAt === null,
          )
          .map((message) => {
            const channelName = state.channels.find((channel) => channel.id === message.channelId)?.name ?? 'unknown';
            const senderDisplayName =
              state.users.find((user) => user.id === message.senderId)?.displayName ?? 'Unknown user';
            const haystack = `${message.content} ${senderDisplayName} ${channelName}`;

            if (!this.matchesAllTerms(haystack, terms)) {
              return null;
            }

            return {
              id: message.id,
              channelId: message.channelId,
              channelName,
              content: message.content,
              preview: this.buildPreview(message.content, terms),
              senderDisplayName,
              matchedTerms: terms.filter((term) => haystack.toLowerCase().includes(term)),
              score:
                this.scoreField(message.content, terms, { exact: 100, prefix: 50, includes: 26 }) +
                this.scoreField(senderDisplayName, terms, { exact: 40, prefix: 24, includes: 12 }) +
                this.scoreField(channelName, terms, { exact: 30, prefix: 18, includes: 10 }) +
                this.recencyScore(message.createdAt),
              createdAt: message.createdAt,
            };
          })
          .filter((message): message is NonNullable<typeof message> => message !== null)
          .sort((left, right) => right.score - left.score || right.createdAt.localeCompare(left.createdAt))
          .slice(0, limit)
      : [];

    const files = scope === 'ALL' || scope === 'FILES'
      ? state.attachments
          .filter((attachment) => attachment.workspaceId === workspaceId)
          .map((attachment) => {
            const message = attachment.messageId
              ? state.messages.find((candidate) => candidate.id === attachment.messageId)
              : null;

            if (message && !filteredChannelIds.has(message.channelId)) {
              return null;
            }

            const previewSource = `${attachment.originalName} ${attachment.mimeType}`;

            if (!this.matchesAllTerms(previewSource, terms)) {
              return null;
            }

            return {
              id: attachment.id,
              messageId: attachment.messageId,
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              url: attachment.url,
              preview: this.buildPreview(previewSource, terms),
              matchedTerms: terms.filter((term) => previewSource.toLowerCase().includes(term)),
              score:
                this.scoreField(attachment.originalName, terms, { exact: 110, prefix: 70, includes: 30 }) +
                this.scoreField(attachment.mimeType, terms, { exact: 20, prefix: 10, includes: 8 }) +
                this.recencyScore(attachment.createdAt),
              createdAt: attachment.createdAt,
            };
          })
          .filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null)
          .sort((left, right) => right.score - left.score || right.createdAt.localeCompare(left.createdAt))
          .slice(0, limit)
      : [];

    const members = scope === 'ALL' || scope === 'MEMBERS'
      ? state.memberships
          .filter((membership) => membership.workspaceId === workspaceId)
          .map((membership) => {
            const user = state.users.find((candidate) => candidate.id === membership.userId);

            if (!user) {
              return null;
            }

            const matchedFields = [
              ...(this.matchesAllTerms(user.displayName, terms) ? ['displayName'] : []),
              ...(this.matchesAllTerms(user.email, terms) ? ['email'] : []),
            ];

            if (matchedFields.length === 0) {
              return null;
            }

            return {
              userId: user.id,
              displayName: user.displayName,
              email: user.email,
              role: membership.role,
              matchedFields,
              score:
                this.scoreField(user.displayName, terms, { exact: 100, prefix: 60, includes: 24 }) +
                this.scoreField(user.email, terms, { exact: 80, prefix: 44, includes: 18 }),
            };
          })
          .filter((member): member is NonNullable<typeof member> => member !== null)
          .sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))
          .slice(0, limit)
      : [];

    return {
      query: rawQuery,
      scope,
      appliedChannelId: query.channelId ?? null,
      totalCount: channels.length + messages.length + files.length + members.length,
      channels,
      messages,
      files,
      members,
    };
  }

  private tokenize(query: string) {
    return Array.from(new Set(query.toLowerCase().split(/\s+/).map((part) => part.trim()).filter(Boolean)));
  }

  private matchesAllTerms(value: string, terms: string[]) {
    const haystack = value.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }

  private scoreField(
    value: string,
    terms: string[],
    weights: { exact: number; prefix: number; includes: number },
  ) {
    const haystack = value.toLowerCase();

    return terms.reduce((total, term) => {
      if (haystack === term) {
        return total + weights.exact;
      }

      if (haystack.startsWith(term)) {
        return total + weights.prefix;
      }

      if (haystack.includes(term)) {
        return total + weights.includes;
      }

      return total;
    }, 0);
  }

  private recencyScore(createdAt: string) {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays <= 1) {
      return 18;
    }

    if (ageDays <= 7) {
      return 10;
    }

    if (ageDays <= 30) {
      return 4;
    }

    return 0;
  }

  private buildPreview(content: string, terms: string[]) {
    const lower = content.toLowerCase();
    const firstIndex = terms.reduce((current, term) => {
      const nextIndex = lower.indexOf(term);

      if (nextIndex === -1) {
        return current;
      }

      return current === -1 ? nextIndex : Math.min(current, nextIndex);
    }, -1);

    if (firstIndex === -1 || content.length <= 96) {
      return content;
    }

    const start = Math.max(0, firstIndex - 28);
    const end = Math.min(content.length, firstIndex + 68);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < content.length ? '…' : '';

    return `${prefix}${content.slice(start, end)}${suffix}`;
  }
}