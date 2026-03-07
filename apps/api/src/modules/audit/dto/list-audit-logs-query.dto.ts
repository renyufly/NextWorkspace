import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import type { AuditAction, AuditEntityType } from '../../local-store/local-store.types.js';

const auditActions = [
  'WORKSPACE_CREATED',
  'WORKSPACE_UPDATED',
  'INVITATION_CREATED',
  'INVITATION_REVOKED',
  'INVITATION_ACCEPTED',
  'MEMBER_ROLE_UPDATED',
  'MEMBER_REMOVED',
  'CHANNEL_CREATED',
  'CHANNEL_UPDATED',
  'CHANNEL_DELETED',
  'CHANNEL_MEMBER_ADDED',
  'CHANNEL_MEMBER_REMOVED',
] as const satisfies readonly AuditAction[];

const auditEntityTypes = [
  'WORKSPACE',
  'INVITATION',
  'WORKSPACE_MEMBER',
  'CHANNEL',
  'CHANNEL_MEMBER',
] as const satisfies readonly AuditEntityType[];

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsIn(auditActions)
  action?: AuditAction;

  @IsOptional()
  @IsIn(auditEntityTypes)
  entityType?: AuditEntityType;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(50)
  limit?: number;
}