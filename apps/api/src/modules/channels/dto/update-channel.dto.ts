import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateChannelDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
