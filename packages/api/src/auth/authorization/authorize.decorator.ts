import {
  BasePrivilege,
  PrivilegeCode,
  TeamBasePrivilege,
  TeamEdfiTenantPrivilege,
  TeamSbEnvironmentPrivilege,
} from '@edanalytics/models';
import { SetMetadata } from '@nestjs/common';

export const AUTHORIZE_KEY = 'authorize_rule';

export type AuthorizeMetadata<
  PrivilegeType extends
    | BasePrivilege
    | TeamBasePrivilege
    | TeamEdfiTenantPrivilege
    | TeamSbEnvironmentPrivilege = PrivilegeCode
> = {
  privilege: PrivilegeType;
  subject: (PrivilegeType extends BasePrivilege ? object : { teamId: 'teamId' }) &
    (PrivilegeType extends TeamEdfiTenantPrivilege ? { edfiTenantId: 'edfiTenantId' } : object) &
    (PrivilegeType extends TeamSbEnvironmentPrivilege
      ? { sbEnvironmentId: 'sbEnvironmentId' }
      : object) & {
      id: string | '__filtered__';
    };
};

export const Authorize = <
  PrivilegeType extends
    | BasePrivilege
    | TeamBasePrivilege
    | TeamEdfiTenantPrivilege
    | TeamSbEnvironmentPrivilege
>(
  config: AuthorizeMetadata<PrivilegeType>
) => SetMetadata(AUTHORIZE_KEY, config);

export const NoAuthorization = () => SetMetadata(AUTHORIZE_KEY, null);
