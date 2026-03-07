import { IsString, MinLength } from 'class-validator';

export class AddChannelMemberDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}