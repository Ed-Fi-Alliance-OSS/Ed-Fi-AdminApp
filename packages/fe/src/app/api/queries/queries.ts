import {
  ApplicationYopassResponseDto,
  GetApplicationDto,
  GetClaimsetDto,
  GetEdorgDto,
  GetOdsDto,
  GetOwnershipDto,
  GetPrivilegeDto,
  GetRoleDto,
  GetSbeDto,
  GetTenantDto,
  GetUserDto,
  GetUserTenantMembershipDto,
  GetVendorDto,
  OperationResultDto,
  PostApplicationForm,
  PostClaimsetDto,
  PostOdsDto,
  PostOwnershipDto,
  PostRoleDto,
  PostSbeDto,
  PostTenantDto,
  PostUserDto,
  PostUserTenantMembershipDto,
  PostVendorDto,
  PrivilegeCode,
  PutApplicationForm,
  PutClaimsetDto,
  PutOdsDto,
  PutOwnershipDto,
  PutSbeAdminApi,
  PutSbeAdminApiRegister,
  PutSbeMeta,
  PutTenantDto,
  PutUserDto,
  PutUserTenantMembershipDto,
  PutVendorDto,
  SbSyncQueueDto,
  SpecificIds,
} from '@edanalytics/models';
import { wait } from '@edanalytics/utils';
import {
  QueryKey,
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { ClassConstructor } from 'class-transformer';
import kebabCase from 'kebab-case';
import path from 'path-browserify';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { apiClient, methods } from '../methods';
import { isEqual } from 'lodash';

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
  tenantId === undefined ? key : [...key, 'tenant', Number(tenantId)];

/** Construct react-query query key in standard format.
 *
 * @return {string[]} query key
 *
 * @example
 * `["sbes", "3", "edorgs", "6", "detail"]` // EdOrg 6 of Sbe 3
 * `["sbes", "3", "edorgs", "list"]` // All EdOrgs of Sbe 3
 * `["sbes", "3", "detail"]` // Sbe 3
 * `["sbes", "list"]` // All-Sbe query
 * `["sbes"]` // All Sbes both in single- and many-item queries
 *
 * `["sbes", "3", "edorgs", "6", "detail", "tenants", "9"]` // EdOrg 6 of Sbe 3, in Tenant 9 context
 * `["sbes", "3", "edorgs", "list", "tenants", "9"]` // All EdOrgs of Sbe 3, in Tenant 9 context
 * `["sbes", "3", "detail", "tenants", "9"]` // Sbe 3, in Tenant 9 context
 * `["sbes", "tenants", "9"]` // All Sbes, in Tenant 9 context
 */
export const queryKey = (params: {
  /** CamelCase or camelCase */
  resourceName: string;
  tenantId?: number | string;
  sbeId?: number | string;
  /** if `undefined`, uses "list" option. If `false`, omits to yield a partial (wildcard) key */
  id?: number | string | false;
}) => {
  const kebabCaseName = kebabCase(params.resourceName).slice(1);
  const tenantKey = params.tenantId === undefined ? [] : ['tenants', String(params.tenantId)];
  const sbeKey = params.sbeId === undefined ? [] : ['sbes', String(params.sbeId)];
  const idKey =
    params.id === undefined ? ['list'] : params.id === false ? [] : ['detail', String(params.id)];

  return [...sbeKey, kebabCaseName + 's', ...idKey, ...tenantKey];
};

export const tenantUrl = (url: string, tenantId?: number | string | undefined) =>
  tenantId === undefined
    ? path.join(baseUrl, url)
    : path.join(baseUrl, 'tenants', String(tenantId), url);

export enum TenantOptions {
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
  authorizeById: boolean;
  includeSbe?: IncludeSbe;
  includeTenant?: IncludeTenant;
  idPropertyKey?: GetType extends { id: number | string } ? undefined : IdType;
}): {
  useOne: (
    args: {
      id: number | string;
      enabled?: boolean;
      optional?: boolean | undefined;
    } & SbeParams &
      TenantParams
  ) => UseQueryResult<GetType, unknown>;
  useAll: (
    args: {
      enabled?: boolean;
      optional?: boolean | undefined;
    } & SbeParams &
      TenantParams
  ) => UseQueryResult<Record<string | number, GetType>, unknown>;
  usePut: (
    args: {
      callback?: ((result: GetType) => void) | undefined;
    } & SbeParams &
      TenantParams
  ) => UseMutationResult<GetType, unknown, PutType, unknown>;
  usePost: (
    args: {
      callback?: ((result: GetType) => void) | undefined;
    } & SbeParams &
      TenantParams
  ) => UseMutationResult<GetType, unknown, PostType, unknown>;
  useDelete: (
    args: {
      callback?: () => void;
    } & SbeParams &
      TenantParams
  ) => UseMutationResult<
    AxiosResponse<unknown, any>,
    unknown,
    string | number | { id: string | number; force?: boolean },
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
  authorizeById: boolean;
  includeSbe?: boolean;
  idPropertyKey?: GetType extends { id: number | string } ? undefined : IdType;
}) {
  const { name, getDto, putDto, postDto, includeSbe, idPropertyKey, authorizeById } = args;
  const kebabCaseName = kebabCase(name).slice(1);
  return {
    useOne: (args: {
      id: number | string;
      tenantId?: number | string;
      sbeId?: number | string;
      enabled?: boolean;
      optional?: boolean | undefined;
    }) => {
      const privilegeCode = `${args.tenantId === undefined ? '' : 'tenant.'}${
        args.sbeId === undefined ? '' : 'sbe.'
      }${kebabCaseName === 'application' ? '.edorg' : ''}${kebabCaseName}:read` as PrivilegeCode;
      const isAuthd = useAuthorize({
        privilege: privilegeCode,
        subject: {
          id: authorizeById ? args.id : '__filtered__',
          sbeId: args.sbeId === undefined ? undefined : Number(args.sbeId),
          tenantId: args.tenantId === undefined ? undefined : Number(args.tenantId),
        },
      });
      return useQuery({
        useErrorBoundary: true,
        enabled:
          (args.enabled === undefined || args.enabled) && (isAuthd || args.optional !== true),
        queryKey: queryKey({
          resourceName: name,
          tenantId: args.tenantId,
          sbeId: args.sbeId,
          id: args.id,
        }),
        queryFn: async () => {
          const url = tenantUrl(
            `${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s/${args.id}`,
            args.tenantId
          );
          return await methods.getOne(url, getDto);
        },
      });
    },
    useAll: (args: {
      tenantId?: number | string;
      sbeId?: number | string;
      enabled?: boolean;
      optional?: boolean | undefined;
    }) => {
      const privilegeCode = `${args.tenantId === undefined ? '' : 'tenant.'}${
        args.sbeId === undefined ? '' : 'sbe.'
      }${kebabCaseName === 'application' ? 'edorg.' : ''}${kebabCaseName}:read` as PrivilegeCode;
      const isAuthd = useAuthorize({
        privilege: privilegeCode,
        subject: {
          id: '__filtered__',
          sbeId: args.sbeId === undefined ? undefined : Number(args.sbeId),
          tenantId: args.tenantId === undefined ? undefined : Number(args.tenantId),
        },
      });
      return useQuery({
        useErrorBoundary: true,
        enabled:
          (args.enabled === undefined || args.enabled) && (isAuthd || args.optional !== true),
        queryKey: queryKey({
          resourceName: name,
          tenantId: args.tenantId,
          sbeId: args.sbeId,
        }),
        queryFn: async () => {
          const url = tenantUrl(
            `${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s`,
            args.tenantId
          );
          return await methods.getManyMap(
            url,
            getDto,
            undefined,
            idPropertyKey ?? ('id' as keyof GetType)
          );
        },
      });
    },
    usePut: (args: {
      tenantId?: number | string;
      sbeId?: number | string;
      callback?: (result: GetType) => void;
    }) => {
      const tenantId = args.tenantId === undefined ? undefined : String(args.tenantId);
      const sbeId = args.sbeId === undefined ? undefined : String(args.sbeId);
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (entity: PutType) =>
          methods.put(
            tenantUrl(
              `${includeSbe ? `sbes/${sbeId}` : ''}/${kebabCaseName}s/${
                entity[(idPropertyKey ?? 'id') as keyof PutType]
              }`,
              tenantId
            ),
            putDto,
            getDto,
            entity
          ),
        onSuccess: (newEntity) => {
          const listKey = tenantKey(
            [...(includeSbe ? ['sbes', sbeId] : []), `${kebabCaseName}s`, 'list'],
            tenantId
          );
          queryClient.invalidateQueries({
            queryKey: queryKey({
              resourceName: name,
              tenantId,
              sbeId,
              id: newEntity[(idPropertyKey ?? 'id') as keyof GetType],
            }),
          });
          queryClient.invalidateQueries({
            queryKey: queryKey({
              resourceName: name,
              tenantId,
              sbeId,
            }),
          });
          args.callback && args.callback(newEntity);
        },
      });
    },
    usePost: (args: {
      tenantId?: number | string;
      sbeId?: number | string;
      callback?: (result: GetType) => void;
    }) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (entity: PostType) =>
          methods.post(
            tenantUrl(`${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s`, args.tenantId),
            postDto,
            getDto,
            entity
          ),
        onSuccess: (newEntity) => {
          queryClient.invalidateQueries({
            queryKey: queryKey({
              resourceName: name,
              tenantId: args.tenantId,
              sbeId: args.sbeId,
            }),
          });
          args.callback && args.callback(newEntity);
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
        mutationFn: (arg: string | number | { id: string | number; force?: boolean }) => {
          const id = typeof arg === 'object' ? arg.id : arg;
          const force = typeof arg === 'object' ? arg.force : false;
          return methods.delete(
            tenantUrl(
              `${includeSbe ? `sbes/${args.sbeId}` : ''}/${kebabCaseName}s/${id}${
                force ? '?force=true' : ''
              }`,
              args.tenantId
            )
          );
        },
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKey({
              resourceName: name,
              tenantId: args.tenantId,
              sbeId: args.sbeId,
            }),
          });
        },
      });
    },
  };
}

export const edorgQueries = makeQueries({
  name: 'Edorg',
  authorizeById: true,
  getDto: GetEdorgDto,
  putDto: class Nothing {},
  postDto: class Nothing {},
  includeSbe: true,
  includeTenant: TenantOptions.Optional,
});

export const odsQueries = makeQueries({
  name: 'Ods',
  authorizeById: true,
  getDto: GetOdsDto,
  putDto: PutOdsDto,
  postDto: PostOdsDto,
  includeSbe: true,
  includeTenant: TenantOptions.Optional,
});

export const ownershipQueries = makeQueries({
  name: 'Ownership',
  authorizeById: false,
  getDto: GetOwnershipDto,
  putDto: PutOwnershipDto,
  postDto: PostOwnershipDto,
  includeSbe: false,
  includeTenant: TenantOptions.Optional,
});

// TODO make it possible to only create some of the verbs (this one is read-only)
export const privilegeQueries = makeQueries({
  name: 'Privilege',
  authorizeById: false,
  getDto: GetPrivilegeDto,
  putDto: GetPrivilegeDto,
  postDto: GetPrivilegeDto,
  includeSbe: false,
  includeTenant: TenantOptions.Never,
});

export const roleQueries = makeQueries({
  name: 'Role',
  authorizeById: false,
  getDto: GetRoleDto,
  putDto: class Nothing {},
  postDto: PostRoleDto,
  includeSbe: false,
  includeTenant: TenantOptions.Optional,
});

export const sbeQueries = makeQueries({
  name: 'Sbe',
  authorizeById: true,
  getDto: GetSbeDto,
  putDto: class Nothing {},
  postDto: PostSbeDto,
  includeSbe: false,
  includeTenant: TenantOptions.Optional,
});

export const tenantQueries = makeQueries({
  name: 'Tenant',
  authorizeById: false,
  getDto: GetTenantDto,
  putDto: PutTenantDto,
  postDto: PostTenantDto,
  includeSbe: false,
  includeTenant: TenantOptions.Never,
});

export const userQueries = makeQueries({
  name: 'User',
  authorizeById: false,
  getDto: GetUserDto,
  putDto: PutUserDto,
  postDto: PostUserDto,
  includeSbe: false,
  includeTenant: TenantOptions.Optional,
});

export const userTenantMembershipQueries = makeQueries({
  name: 'UserTenantMembership',
  authorizeById: false,
  getDto: GetUserTenantMembershipDto,
  putDto: PutUserTenantMembershipDto,
  postDto: PostUserTenantMembershipDto,
  includeSbe: false,
  includeTenant: TenantOptions.Optional,
});

export const vendorQueries = makeQueries({
  name: 'Vendor',
  authorizeById: false,
  getDto: GetVendorDto,
  putDto: PutVendorDto,
  postDto: PostVendorDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const applicationQueries = makeQueries({
  name: 'Application',
  authorizeById: true,
  getDto: GetApplicationDto,
  putDto: PutApplicationForm,
  postDto: PostApplicationForm,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const claimsetQueries = makeQueries({
  name: 'Claimset',
  authorizeById: false,
  getDto: GetClaimsetDto,
  putDto: PutClaimsetDto,
  postDto: PostClaimsetDto,
  includeSbe: true,
  includeTenant: TenantOptions.Required,
});

export const sbSyncQueueQueries = makeQueries({
  name: 'SbSyncQueue',
  authorizeById: false,
  getDto: SbSyncQueueDto,
  putDto: class Nothing {},
  postDto: class Nothing {},
  includeSbe: false,
  includeTenant: TenantOptions.Never,
});

export const usePostSbSyncQueue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      methods.post(`${baseUrl}/sb-sync-queues`, class Nothing {}, OperationResultDto, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'SbSyncQueue' }),
      });
    },
  });
};

export const useSbeEditSbMeta = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sbe: PutSbeMeta) =>
      methods.put(`${baseUrl}/sbes/${sbe.id}/sbe-meta`, PutSbeMeta, GetSbeDto, sbe),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'Sbe', id: data.id }),
      });
      callback && callback();
    },
  });
};
export const useSbeEditAdminApi = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sbe: PutSbeAdminApi) =>
      methods.put(`${baseUrl}/sbes/${sbe.id}/admin-api`, PutSbeAdminApi, GetSbeDto, sbe),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'Sbe', id: data.id }),
      });
      callback && callback();
    },
  });
};
export const useSbeRegisterAdminApi = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sbe: PutSbeAdminApi) =>
      methods.put(
        `${baseUrl}/sbes/${sbe.id}/register-admin-api`,
        PutSbeAdminApiRegister,
        GetSbeDto,
        sbe
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'Sbe', id: data.id }),
      });
      callback && callback();
    },
  });
};
export const useSbeCheckAdminAPI = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sbe: GetSbeDto) =>
      methods.put(
        `${baseUrl}/sbes/${sbe.id}/check-admin-api`,
        class Nothing {},
        OperationResultDto,
        {}
      ),
    onSuccess: (res, original) => {
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'Sbe', id: original.id }),
      });
      callback && callback();
    },
  });
};

export const useSbeRefreshResources = (callback?: () => void) => {
  const queryClient = useQueryClient();
  const popBanner = usePopBanner();
  return useMutation({
    mutationFn: (sbe: GetSbeDto) =>
      methods.put(
        `${baseUrl}/sbes/${sbe.id}/refresh-resources`,
        class Nothing {},
        SbSyncQueueDto,
        {}
      ),
    onSuccess: (resp, prior) => {
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'Sbe', id: prior.id }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKey({ resourceName: 'SbSyncQueue' }),
      });
      callback && callback();
    },
    ...mutationErrCallback({ popBanner }),
  });
};

export const useApplicationPost = (args: {
  tenantId?: number | string;
  sbeId?: number | string;
  callback?: (response: ApplicationYopassResponseDto) => void;
}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entity: PostApplicationForm) =>
      methods.post(
        tenantUrl(`sbes/${args.sbeId}/applications`, args.tenantId),
        PostApplicationForm,
        ApplicationYopassResponseDto,
        entity
      ),
    onSuccess: (newEntity) => {
      queryClient.invalidateQueries({
        queryKey: queryKey({
          resourceName: 'Application',
          tenantId: args.tenantId,
          sbeId: args.sbeId,
        }),
      });
      // refetch because of the "applications count" field on claimsets
      queryClient.invalidateQueries({
        queryKey: queryKey({
          resourceName: 'Claimset',
          tenantId: args.tenantId,
          sbeId: args.sbeId,
        }),
      });
      args.callback && args.callback(newEntity);
    },
  });
};

export const useApplicationResetCredential = (args: {
  tenantId?: number | string;
  sbeId?: number | string;
  callback?: (response: ApplicationYopassResponseDto) => void;
}) => {
  return useMutation({
    mutationFn: (entity: GetApplicationDto) =>
      methods.put(
        tenantUrl(
          `sbes/${args.sbeId}/applications/${entity.applicationId}/reset-credential`,
          args.tenantId
        ),
        class Nothing {},
        ApplicationYopassResponseDto,
        {}
      ),
    onSuccess: (newEntity) => {
      args.callback && args.callback(newEntity);
    },
  });
};
export function usePrivilegeCache<
  ConfigType extends {
    privilege: PrivilegeCode;
    tenantId?: string | number;
    sbeId?: string | number;
  }
>(config: ConfigType[]) {
  return useQueries({
    queries: config.map((c) => {
      return {
        staleTime: 15 * 1000,
        notifyOnChangeProps: ['data' as const],
        queryKey: [
          'authorizations',
          c.tenantId === undefined ? undefined : String(c.tenantId),
          c.sbeId === undefined ? undefined : String(c.sbeId),
          c.privilege,
        ],
        queryFn: () =>
          apiClient.get(
            `/auth/authorizations/${c.privilege}/${c.tenantId === undefined ? '' : c.tenantId}${
              c.sbeId === undefined ? '' : `?sbeId=${c.sbeId}`
            }`
          ),
        select: privilegeSelector,
      };
    }),
  });
}
export const privilegeSelector = (res: any) => {
  return (Array.isArray(res) ? new Set(res) : res) as SpecificIds | true | false;
};
