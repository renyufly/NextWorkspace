import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

class DigestModeEnum {
  static readonly OFF = 'OFF';
  static readonly DAILY = 'DAILY';
}

export class UpdateNotificationPreferencesDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @IsBoolean()
  muteAll?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMentions?: boolean;

  @IsOptional()
  @IsBoolean()
  emailMentions?: boolean;

  @IsOptional()
  @IsBoolean()
  emailDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  pushMentions?: boolean;

  @IsOptional()
  @IsBoolean()
  pushDigest?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutedChannelIds?: string[];

  @IsOptional()
  @IsEnum(DigestModeEnum)
  digestMode?: 'OFF' | 'DAILY';
}