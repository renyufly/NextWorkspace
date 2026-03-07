import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import type { WorkspaceSearchScope } from '@worknext/shared';

const searchScopes = ['ALL', 'CHANNELS', 'MESSAGES', 'FILES', 'MEMBERS'] as const satisfies readonly WorkspaceSearchScope[];

export class SearchWorkspaceQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(searchScopes)
  scope?: WorkspaceSearchScope;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(20)
  limit?: number;
}