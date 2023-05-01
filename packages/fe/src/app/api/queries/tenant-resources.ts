import { GetEdorgDto, GetOdsDto, GetOwnershipDto, GetRoleDto, GetSbeDto, GetUserDto, GetUserTenantMembershipDto } from "@edanalytics/models";
import { useQuery } from "@tanstack/react-query";
import { methods } from "../methods";
const baseUrl = '';

export const useTenantSbes = (tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `sbes`],
    queryFn: () => methods.getManyMap<GetSbeDto>(`${baseUrl}/tenants/${tenantId}/sbes`, GetSbeDto),
  });

export const useTenantEdorgs = (sbeId: number | string, tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `edorgs`, 'sbe', sbeId],
    queryFn: () =>
      methods.getManyMap<GetEdorgDto>(`${baseUrl}/tenants/${tenantId}/sbes/${sbeId}/edorgs`, GetEdorgDto),
  });

export const useTenantOdss = (sbeId: number | string, tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `odss`, 'sbe', sbeId],
    queryFn: () => methods.getManyMap<GetOdsDto>(`${baseUrl}/tenants/${tenantId}/sbes/${sbeId}/odss`, GetOdsDto),
  });

export const useTenantOwnerships = (tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `ownerships`],
    queryFn: () =>
      methods.getManyMap<GetOwnershipDto>(
        `${baseUrl}/tenants/${tenantId}/ownerships`,
        GetOwnershipDto
      ),
  });

export const useTenantRoles = (tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `roles`],
    queryFn: () =>
      methods.getManyMap<GetRoleDto>(`${baseUrl}/tenants/${tenantId}/roles`, GetRoleDto),
  });

export const useTenantUserTenantMemberships = (tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `user-tenant-memberships`],
    queryFn: () =>
      methods.getManyMap<GetUserTenantMembershipDto>(
        `${baseUrl}/tenants/${tenantId}/user-tenant-memberships`,
        GetUserTenantMembershipDto
      ),
  });

export const useTenantUsers = (tenantId: number | string) =>
  useQuery({
    queryKey: ['tenant', tenantId, `users`],
    queryFn: () =>
      methods.getManyMap(
        `${baseUrl}/tenants/${tenantId}/users`,
        GetUserDto
      ),
  });
