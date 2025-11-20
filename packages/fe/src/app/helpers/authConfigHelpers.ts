import {
  BasePrivilege,
  TeamBasePrivilege,
  TeamEdfiTenantPrivilege,
  TeamSbEnvironmentPrivilege,
} from '@edanalytics/models';
import { AuthorizeConfig } from '.';

export const teamBaseAuthConfig = (
  id: number | '__filtered__' | undefined,
  teamId: number | string | undefined,
  privilege: TeamBasePrivilege
): AuthorizeConfig | undefined =>
  id === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: Number(teamId),
          id: id,
        },
      };
export const teamSbEnvironmentAuthConfig = (
  id: number | '__filtered__' | undefined,
  sbEnvironmentId: number | undefined,
  teamId: number | string | undefined,
  privilege: TeamSbEnvironmentPrivilege
): AuthorizeConfig | undefined =>
  id === undefined || teamId === undefined || sbEnvironmentId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: Number(teamId),
          sbEnvironmentId: sbEnvironmentId,
          id: id,
        },
      };
export const teamEdfiTenantAuthConfig = (
  id: number | '__filtered__' | undefined,
  edfiTenantId: number | undefined,
  teamId: number | string | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  id === undefined || teamId === undefined || edfiTenantId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: Number(teamId),
          edfiTenantId: edfiTenantId,
          id: id,
        },
      };
export const teamRoleAuthConfig = (
  roleId: number | '__filtered__' | undefined,
  teamId: number | string | undefined,
  privilege: Extract<
    TeamBasePrivilege,
    'team.role:read' | 'team.role:create' | 'team.role:update' | 'team.role:delete'
  >
): AuthorizeConfig | undefined =>
  roleId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: Number(teamId),
          id: roleId,
        },
      };
export const globalRoleAuthConfig = (
  roleId: number | '__filtered__' | undefined,
  privilege: BasePrivilege
): AuthorizeConfig | undefined =>
  roleId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          id: roleId,
        },
      };
export const globalOwnershipAuthConfig = (
  privilege: BasePrivilege
): AuthorizeConfig | undefined => ({
  privilege,
  subject: {
    id: '__filtered__',
  },
});
export const globalTeamAuthConfig = (privilege: BasePrivilege): AuthorizeConfig | undefined => ({
  privilege,
  subject: {
    id: '__filtered__',
  },
});

export const utmAuthConfig = (
  teamId: number | undefined,
  privilege: TeamBasePrivilege
): AuthorizeConfig | undefined =>
  teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: '__filtered__',
        },
      };

export const ownershipAuthConfig = (
  teamId: number | undefined,
  privilege: TeamBasePrivilege
): AuthorizeConfig | undefined =>
  teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: '__filtered__',
        },
      };

export const applicationAuthConfig = (
  edorgId: string | undefined,
  edfiTenantId: number | undefined,
  teamId: number | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  edorgId === undefined || edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: edorgId,
          edfiTenantId: edfiTenantId,
        },
      };

export const vendorAuthConfig = (
  edfiTenantId: number | undefined,
  teamId: number | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: '__filtered__',
          edfiTenantId: edfiTenantId,
        },
      };

export const profileAuthConfig = (
  edfiTenantId: number | undefined,
  teamId: number | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: '__filtered__',
          edfiTenantId: edfiTenantId,
        },
      };
export const claimsetAuthConfig = (
  edfiTenantId: number | undefined,
  teamId: number | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: '__filtered__',
          edfiTenantId: edfiTenantId,
        },
      };

export const odsAuthConfig = (
  odsId: number | '__filtered__' | undefined,
  edfiTenantId: number | undefined,
  teamId: number | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  odsId === undefined || edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: odsId,
          edfiTenantId: edfiTenantId,
        },
      };

export const edfiTenantAuthConfig = (
  edfiTenantId: string | number | '__filtered__' | undefined,
  teamId: string | number | undefined,
  privilege: TeamBasePrivilege
): AuthorizeConfig | undefined =>
  edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: Number(teamId),
          id: edfiTenantId === '__filtered__' ? edfiTenantId : Number(edfiTenantId),
        },
      };

export const globalEdfiTenantAuthConfig = (
  edfiTenantId: number | '__filtered__' | undefined,
  privilege: BasePrivilege
): AuthorizeConfig | undefined =>
  edfiTenantId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          id: edfiTenantId,
        },
      };
export const globalSbEnvironmentAuthConfig = (
  sbEnvironmentId: number | '__filtered__' | undefined,
  privilege: BasePrivilege
): AuthorizeConfig | undefined =>
  sbEnvironmentId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          id: sbEnvironmentId,
        },
      };

export const globalUserAuthConfig = (privilege: BasePrivilege): AuthorizeConfig | undefined => ({
  privilege,
  subject: {
    id: '__filtered__',
  },
});
export const globalUtmAuthConfig = (privilege: BasePrivilege): AuthorizeConfig | undefined => ({
  privilege,
  subject: {
    id: '__filtered__',
  },
});
export const teamUserAuthConfig = (
  userId: number | '__filtered__' | undefined,
  teamId: number | undefined,
  privilege: TeamBasePrivilege
): AuthorizeConfig | undefined =>
  userId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: userId,
        },
      };

export const edorgAuthConfig = (
  edorgId: number | '__filtered__' | undefined,
  edfiTenantId: number | undefined,
  teamId: number | undefined,
  privilege: TeamEdfiTenantPrivilege
): AuthorizeConfig | undefined =>
  edorgId === undefined || edfiTenantId === undefined || teamId === undefined
    ? undefined
    : {
        privilege,
        subject: {
          teamId: teamId,
          id: edorgId,
          edfiTenantId: edfiTenantId,
        },
      };
