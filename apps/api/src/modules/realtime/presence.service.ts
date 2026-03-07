import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LocalStoreService } from '../local-store/local-store.service.js';

@Injectable()
export class PresenceService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStoreService: LocalStoreService,
  ) {}

  async recordHeartbeat(userId: string) {
    const now = new Date().toISOString();

    await this.localStoreService.updateState((state) => {
      const presence = state.presences.find((candidate) => candidate.userId === userId);

      if (presence) {
        presence.status = 'online';
        presence.lastSeenAt = now;
        presence.updatedAt = now;
        return;
      }

      state.presences.push({
        userId,
        status: 'online',
        lastSeenAt: now,
        updatedAt: now,
      });
    });
  }

  async recordDisconnect(userId: string) {
    const now = new Date().toISOString();

    await this.localStoreService.updateState((state) => {
      const presence = state.presences.find((candidate) => candidate.userId === userId);

      if (!presence) {
        state.presences.push({
          userId,
          status: 'offline',
          lastSeenAt: now,
          updatedAt: now,
        });
        return;
      }

      presence.status = 'offline';
      presence.updatedAt = now;
    });
  }

  async listOnlineUserIds(workspaceId: string) {
    const state = await this.localStoreService.readState();
    const ttlSeconds = this.configService.get<number>('REDIS_PRESENCE_TTL_SECONDS', 45);
    const cutoff = Date.now() - ttlSeconds * 1000;
    const workspaceMemberIds = new Set(
      state.memberships
        .filter((membership) => membership.workspaceId === workspaceId)
        .map((membership) => membership.userId),
    );

    return state.presences
      .filter(
        (presence) =>
          workspaceMemberIds.has(presence.userId) && new Date(presence.lastSeenAt).getTime() >= cutoff,
      )
      .map((presence) => presence.userId);
  }
}