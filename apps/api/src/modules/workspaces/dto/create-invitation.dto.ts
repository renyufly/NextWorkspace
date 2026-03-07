import { IsEmail, IsIn } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsIn(['OWNER', 'ADMIN', 'MEMBER'])
  role!: 'OWNER' | 'ADMIN' | 'MEMBER';
}