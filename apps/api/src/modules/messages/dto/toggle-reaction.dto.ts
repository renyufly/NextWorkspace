import { IsString, MaxLength, MinLength } from 'class-validator';

export class ToggleReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji!: string;
}