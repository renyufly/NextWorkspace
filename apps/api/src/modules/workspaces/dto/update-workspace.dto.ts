import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;
}
