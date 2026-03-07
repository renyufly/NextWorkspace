import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsUUID()
  parentMessageId?: string;
}