import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { AuditLogSummary } from '@worknext/shared';

import type { AuditAction, AuditEntityType, LocalStoreState } from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

type AuditMetadata = Record<string, string | number | boolean | null>;

type AppendAuditLogInput = {
  workspaceId: string;
  actorUserId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string | null;
  targetUserId?: string | null;
  metadata?: AuditMetadata;
  createdAt?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly localStoreService: LocalStoreService) {}

  append(state: LocalStoreState, input: AppendAuditLogInput) {
    const actor = state.users.find((candidate) => candidate.id === input.actorUserId);
    const target = input.targetUserId
      ? state.users.find((candidate) => candidate.id === input.targetUserId)
      : null;

    state.auditLogs.push({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorDisplayName: actor?.displayName ?? 'Unknown user',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel ?? null,
      targetUserId: input.targetUserId ?? null,
      targetDisplayName: target?.displayName ?? null,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  async list(userId: string, workspaceId: string, query: ListAuditLogsQueryDto): Promise<AuditLogSummary[]> {
    const state = await this.localStoreService.readState();
    const membership = state.memberships.find(
      (candidate) => candidate.workspaceId === workspaceId && candidate.userId === userId,
    );

    if (!membership) {
      throw new ForbiddenException('Workspace membership is required.');
    }

    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Only admins and owners can view audit logs.');
    }

    const limit = query.limit ?? 12;
    const term = query.q?.trim().toLowerCase() ?? '';

    return state.auditLogs
      .filter((log) => log.workspaceId === workspaceId)
      .filter((log) => !query.action || log.action === query.action)
      .filter((log) => !query.entityType || log.entityType === query.entityType)
      .filter((log) => !query.actorUserId || log.actorUserId === query.actorUserId)
      .filter((log) => {
        if (!term) {
          return true;
        }

        return [
          log.actorDisplayName,
          log.targetDisplayName ?? '',
          log.entityLabel ?? '',
          log.action,
          ...Object.values(log.metadata).map((value) => (value === null ? '' : String(value))),
        ].some((value) => value.toLowerCase().includes(term));
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((log) => ({ ...log }));
  }
}