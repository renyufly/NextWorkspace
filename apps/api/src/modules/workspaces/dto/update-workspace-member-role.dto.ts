import { IsIn } from 'class-validator';

export class UpdateWorkspaceMemberRoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role!: 'ADMIN' | 'MEMBER';
}