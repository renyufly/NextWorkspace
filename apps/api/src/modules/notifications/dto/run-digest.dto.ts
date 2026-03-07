import { IsString } from 'class-validator';

export class RunDigestDto {
  @IsString()
  workspaceId!: string;
}