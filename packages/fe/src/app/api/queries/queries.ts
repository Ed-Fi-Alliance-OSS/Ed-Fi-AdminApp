import {
  GetApplicationDto,
  GetClaimsetDto,
  GetEdorgDto,
  GetOdsDto,
  GetOwnershipDto,
  GetPrivilegeDto,
  GetResourceDto,
  GetRoleDto,
  GetSbeDto,
  GetTenantDto,
  GetUserDto,
  GetUserTenantMembershipDto,
  GetVendorDto,
  PostApplicationDto,
  PostClaimsetDto,
  PostEdorgDto,
  PostOdsDto,
  PostOwnershipDto,
  PostResourceDto,
  PostRoleDto,
  PostSbeDto,
  PostTenantDto,
  PostUserDto,
  PostUserTenantMembershipDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutEdorgDto,
  PutOdsDto,
  PutOwnershipDto,
  PutResourceDto,
  PutRoleDto,
  PutSbeDto,
  PutTenantDto,
  PutUserDto,
  PutUserTenantMembershipDto,
  PutVendorDto,
} from '@edanalytics/models';
import {
  QueryKey,
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ClassConstructor } from 'class-transformer';
import kebabCase from 'kebab-case';
import path from 'path-browserify';
import { methods } from '../methods';
import { AxiosResponse } from 'axios';

const baseUrl = '';

/**
 * Add optional tenant to query key.
 *
 * Goes at the end, which means it's easier to refresh by Sbe/Ods
 * than by tenant (i.e., easier to refresh upon resource updates
 * than upon tenant ownership updates).
 *
 * Standard key schema lists all resource hierarchy levels each in
 * the format of `[names, nameId]`. The target resource uses that
 * pattern as well, but also gets a `'list'` or `'detail'` string.
 * This way you can optionally target queries at any hierarchy
 * level without refetching deeply nested queries.
 *
 * ```
 * // Example using education organizations:
 * ['sbes', 3, 'edorgs', 6, 'detail']
 *
 * // To refetch Sbe 3 without refetching its EdOrgs, use these keys:
 * ['sbes', 3, 'list']
 * ['sbes', 3, 'detail']
 *
 * // Or if you do want to refetch its children:
 * ['sbes', 3]
 * ```
 */
export const tenantKey = (key: QueryKey, tenantId?: number | string) =>
  tenantId === undefined ? key : [...key, 'tenant', tenantId];

export const tenantUrl = (url: string, tenantId?: number | string) =>
  tenantId === undefined
    ? path.join(baseUrl, url)
    : path.join(baseUrl, 'tenants', String(tenantId), url);

enum TenantOptions {
  Never,
  Optional,
  Required,
}

type SbeParamsType<IncludeSbe extends boolean> = IncludeSbe extends true
  ? { sbeId: number | string }
  : object;

function makeQueries<
  GetType extends Record<IdType, any>,
  PutType extends Record<IdType, any>,
  PostType extends object,
  IdType extends string,
  IncludeSbe extends boolean,
  SbeParams extends SbeParamsType<IncludeSbe>,
  IncludeTenant extends TenantOptions,
  TenantParams extends IncludeTenant extends TenantOptions.Never
  ? object
  : IncludeTenant extends TenantOptions.Optional
  ? { tenantId?: string | number | undefined }
  : { tenantId: string | number }
>(args: {
  name: string;
  getDto: ClassConstructor<GetType>;
  putDto: ClassConstructor<PutType>;
  postDto: ClassConstructor<PostType>;
  includeSbe?: IncludeSbe;
  includeTenant?: IncludeTenant;
  idPropertyKey?: GetType extends { id: number | string } ? undefined : IdType;
}): {
  useOne: (
    args: {
      id: number | string;
      enabled?: boolean;
    } & SbeParams &
      TenantParams
  ) => UseQueryResult<GetType, unknown>;
  useAll: (
    args: {
      enabled?: boolean;
    } & SbeParams &
      TenantParams
  ) => UseQueryResult<Record<string | number, GetType>, unknown>;
  usePut: (
    args: {
      callback?: (() => void) | undefined;
    } & SbeParams &
      TenantParams
  ) => UseMutationResult<GetType, unknown, PutType, unknown>;
  useDelete: (
    args: {
      callback?: () => void;
    } & SbeParams &
      TenantParams
  ) => UseMutationResult<
    AxiosResponse<unknown, any>,
    unknown,
    string | number,
    unknown
  >;
};

function makeQueries<
  GetType extends Record<IdType, any>,
  PutType extends Record<IdType, any>,
  PostType extends object,
  IdType extends string
>(args: {
  name: string;
  getDto: ClassConstructor<GetType>;
  putDto: ClassConstructor<PutType>;
  postDto: ClassConstructor<PostType>;
  includeSbe?: boolean;
  idPropertyKey?: GetType extends { id: number | string } ? undefined : IdType;
}) {
  const { name, getDto, putDto, postDto, includeSbe, idPropertyKey } = args;
  const kebabCaseName = kebabCase(name).slice(1);
  return {
    useOne: (args: {
      id: number | string;
      tenantId?: number | string;
      sbeId?: number | string;
      enabled?: boolean;
    }) =>
      useQuery({
        enabled: args.enabled === undefined || args.enabled,
        queryKey: tenantKey(
          [
            ...(includeSbe ? ['sbes', args.sbeId] : []),
            `${kebabCaseName}s`,
            'detail',
            args.id,
          ],
          args.tenantId
        ),
        queryFn: () =>
          methods.getOne(
            tenantUrl(
              `${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s/${args.id
              }`,
              args.tenantId
            ),
            getDto
          ),
      }),
    useAll: (args: {
      tenantId?: number | string;
      sbeId?: number | string;
      enabled?: boolean;
    }) =>
      useQuery({
        enabled: args.enabled === undefined || args.enabled,
        queryKey: tenantKey(
          [
            ...(includeSbe ? ['sbes', args.sbeId] : []),
            `${kebabCaseName}s`,
            'list',
          ],
          args.tenantId
        ),
        queryFn: () =>
          methods.getManyMap(
            tenantUrl(
              `${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s`,
              args.tenantId
            ),
            getDto,
            undefined,
            idPropertyKey ?? ('id' as keyof GetType)
          ),
      }),
    usePut: (args: {
      tenantId?: number | string;
      sbeId?: number | string;
      callback?: () => void;
    }) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (entity: PutType) =>
          methods.put(
            tenantUrl(
              `${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s/${entity[(idPropertyKey ?? 'id') as keyof PutType]
              }`,
              args.tenantId
            ),
            putDto,
            getDto,
            entity
          ),
        onSuccess: (newEntity) => {
          queryClient.invalidateQueries({
            queryKey: tenantKey(
              [
                ...(includeSbe ? ['sbes', args.sbeId] : []),
                `${kebabCaseName}s`,
                'list',
              ],
              args.tenantId
            ),
          });
          args.callback && args.callback();
        },
      });
    },
    useDelete: (args: {
      tenantId?: number | string;
      sbeId?: number | string;
      callback?: () => void;
    }) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (id: string | number) =>
          methods.delete(
            tenantUrl(
              `${includeSbe ? `sbes/${args.sbeId}` : ''
              }/${kebabCaseName}s/${id}`,
              args.tenantId
            )
          ),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: tenantKey(
              [
                ...(includeSbe ? ['sbes', args.sbeId] : []),
                `${kebabCaseName}s`,
                'list',
              ],
              args.tenantId
            ),
          });
        },
      });
    },
  };
}

export const edorgQueries = makeQueries({
  name: 'Edorg',
  getDto: GetEdorgDto,
  putDto: PutEdorgDto,
  postDto: PostEdorgDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const odsQueries = makeQueries({
  name: 'Ods',
  getDto: GetOdsDto,
  putDto: PutOdsDto,
  postDto: PostOdsDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const ownershipQueries = makeQueries({
  name: 'Ownership',
  getDto: GetOwnershipDto,
  putDto: PutOwnershipDto,
  postDto: PostOwnershipDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

// TODO make it possible to only create some of the verbs (this one is read-only)
export const privilegeQueries = makeQueries({
  name: 'Privilege',
  getDto: GetPrivilegeDto,
  putDto: GetPrivilegeDto,
  postDto: GetPrivilegeDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

export const resourceQueries = makeQueries({
  name: 'Resource',
  getDto: GetResourceDto,
  putDto: PutResourceDto,
  postDto: PostResourceDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

export const roleQueries = makeQueries({
  name: 'Role',
  getDto: GetRoleDto,
  putDto: PutRoleDto,
  postDto: PostRoleDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

export const sbeQueries = makeQueries({
  name: 'Sbe',
  getDto: GetSbeDto,
  putDto: PutSbeDto,
  postDto: PostSbeDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

export const tenantQueries = makeQueries({
  name: 'Tenant',
  getDto: GetTenantDto,
  putDto: PutTenantDto,
  postDto: PostTenantDto,
  includeSbe: false,
  includeTenant: TenantOptions.Never,
});

export const userQueries = makeQueries({
  name: 'User',
  getDto: GetUserDto,
  putDto: PutUserDto,
  postDto: PostUserDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

export const userTenantMembershipQueries = makeQueries({
  name: 'UserTenantMembership',
  getDto: GetUserTenantMembershipDto,
  putDto: PutUserTenantMembershipDto,
  postDto: PostUserTenantMembershipDto,
  includeSbe: false,
  includeTenant: TenantOptions.Required,
});

export const vendorQueries = makeQueries({
  name: 'Vendor',
  getDto: GetVendorDto,
  putDto: PutVendorDto,
  postDto: PostVendorDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const applicationQueries = makeQueries({
  name: 'Application',
  getDto: GetApplicationDto,
  putDto: PutApplicationDto,
  postDto: PostApplicationDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const claimsetQueries = makeQueries({
  name: 'Claimset',
  getDto: GetClaimsetDto,
  putDto: PutClaimsetDto,
  postDto: PostClaimsetDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});
