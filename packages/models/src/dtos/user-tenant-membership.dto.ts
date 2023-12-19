import { Expose } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { IRole, ITenant, IUser } from '../interfaces';
import { IUserTenantMembership } from '../interfaces/user-tenant-membership.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetUserTenantMembershipDto
  extends DtoGetBase
  implements GetDto<IUserTenantMembership, 'tenant' | 'user' | 'role'>
{
  @Expose()
  tenantId: ITenant['id'];
  @Expose()
  userId: IUser['id'];
  @Expose()
  roleId?: IRole['id'];

  override get displayName() {
    return 'Membership';
  }
}
export const toGetUserTenantMembershipDto = makeSerializer(GetUserTenantMembershipDto);

export class PutUserTenantMembershipDto
  extends DtoPutBase
  implements PutDto<IUserTenantMembership, 'tenant' | 'user' | 'role' | 'tenantId' | 'userId'>
{
  @IsNumber()
  @IsOptional()
  @Expose()
  roleId: IRole['id'];
}

export class PostUserTenantMembershipDto
  extends DtoPostBase
  implements PostDto<IUserTenantMembership, 'tenant' | 'user' | 'role'>
{
  @IsNumber()
  @Expose()
  tenantId: ITenant['id'];
  @IsNumber()
  @Expose()
  userId: IUser['id'];
  @IsNumber()
  @IsOptional()
  @Expose()
  roleId: IRole['id'];
}
