import { Expose } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { IRole, ITeam, IUser, IUserTeamMembership } from '../interfaces';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetUserTeamMembershipDto
  extends DtoGetBase
  implements GetDto<IUserTeamMembership, 'team' | 'user' | 'role'>
{
  @Expose()
  teamId: ITeam['id'];
  @Expose()
  userId: IUser['id'];
  @Expose()
  roleId?: IRole['id'];

  override get displayName() {
    return 'Membership';
  }
}
export const toGetUserTeamMembershipDto = makeSerializer(GetUserTeamMembershipDto);

export class PutUserTeamMembershipDto
  extends DtoPutBase
  implements PutDto<IUserTeamMembership, 'team' | 'user' | 'role' | 'teamId' | 'userId'>
{
  @IsNumber()
  @IsOptional()
  @Expose()
  roleId: IRole['id'];
}

export class PostUserTeamMembershipDto
  extends DtoPostBase
  implements PostDto<IUserTeamMembership, 'team' | 'user' | 'role'>
{
  @IsNumber()
  @Expose()
  teamId: ITeam['id'];
  @IsNumber()
  @Expose()
  userId: IUser['id'];
  @IsNumber()
  @IsOptional()
  @Expose()
  roleId: IRole['id'];
}
