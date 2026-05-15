import {
  ApiClientResponseV3,
  ApplicationResponseV3,
  CopyClaimsetDtoV3,
  GetApiClientDtoV3,
  GetApplicationDtoV3,
  GetClaimsetMultipleDtoV3,
  GetClaimsetSingleDtoV3,
  GetOdsInstanceSummaryDtoV3,
  GetProfileDtoV3,
  GetVendorDtoV3,
  Id,
  PostApiClientDtoV3,
  PostApiClientResponseDtoV3,
  ImportClaimsetSingleDtoV3,
  PostApplicationFormDtoV3,
  PostClaimsetDtoV3,
  PostProfileDtoV3,
  PostVendorDtoV3,
  PutApiClientDtoV3,
  PutApplicationFormDtoV3,
  PutClaimsetFormDtoV3,
  PutProfileDtoV3,
  PutVendorDtoV3,
} from '@edanalytics/models';
import { EntityQueryBuilder, queryKeyNew, standardPath } from './builder';
import { TeamOptions } from './queries';

export const applicationQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Application',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetApplicationDtoV3 })
  .getOne('getOne', { ResDto: GetApplicationDtoV3 })
  .put('put', { ResDto: GetApplicationDtoV3, ReqDto: PutApplicationFormDtoV3 })
  .put(
    'resetCreds',
    {
      ResDto: undefined as unknown as ApplicationResponseV3,
      ReqDto: Id,
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'application',
        adminApi: true,
        id: `${base.entity.id}/reset-credential`,
      })
  )
  .post('post', { ResDto: undefined as unknown as ApplicationResponseV3, ReqDto: PostApplicationFormDtoV3 })
  .delete('delete')
  .build();

export const apiClientQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'ApiClient',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll(
    'getAll',
    { ResDto: GetApiClientDtoV3 },
    (base, extras: { applicationId?: number }) => {
      const query =
        extras?.applicationId === undefined
          ? ''
          : `?applicationId=${extras.applicationId}`;
      return standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiclient',
        adminApi: true,
        id: query,
      });
    }
  )
  .getOne('getOne', { ResDto: GetApiClientDtoV3 },
    (base) => {
      return standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiclient',
        adminApi: true,
        id: base.id,
      });
    })
  .put(
    'put',
    { ResDto: GetApiClientDtoV3, ReqDto: PutApiClientDtoV3 },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiclient',
        adminApi: true,
        id: base.entity.id,
      })
  )
  .put(
    'resetCreds',
    {
      ResDto: undefined as unknown as ApiClientResponseV3,
      ReqDto: Id,
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiclient',
        adminApi: true,
        id: `${base.entity.id}/reset-credential`,
      })
  )
  .post(
    'post',
    { ResDto: PostApiClientResponseDtoV3, ReqDto: PostApiClientDtoV3 },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'apiclient',
        adminApi: true,
      })
  )
  .delete(
    'delete',
    {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      path: (base: any) => {
        const edfiTenant = base.queryParams?.edfiTenant ?? base.edfiTenant;
        const teamId = base.queryParams?.teamId ?? base.teamId;
        return standardPath({
          edfiTenant,
          teamId,
          kebabCaseName: 'apiclient',
          adminApi: true,
          id: base.id,
        });
      },
    } as any
  )
  .build();

export const claimsetQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Claimset',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetClaimsetSingleDtoV3 })
  .post(
    'createExport',
    { ResDto: Id, ReqDto: class Nothing {} },
    (base, pathParams: { ids: number[] }) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `export?id=${pathParams.ids.join('&id=')}`,
      })
  )
  .getAll('getAll', { ResDto: GetClaimsetMultipleDtoV3 })
  .put('put', { ResDto: GetClaimsetSingleDtoV3, ReqDto: PutClaimsetFormDtoV3 })
  .post('post', { ResDto: GetClaimsetSingleDtoV3, ReqDto: PostClaimsetDtoV3 })
  .post(
    'import',
    {
      ResDto: Id,
      ReqDto: ImportClaimsetSingleDtoV3,
      keysToInvalidate: (base) => [
        queryKeyNew({
          ...base.standardQueryKeyParams,
          pathOverride: undefined,
          id: undefined,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `import`,
      })
  )
  .post(
    'copy',
    {
      ResDto: Id,
      ReqDto: CopyClaimsetDtoV3,
      keysToInvalidate: (params) => [
        params.standard,
        queryKeyNew({
          kebabCaseName: 'claimset',
          edfiTenant: params.edfiTenant,
          id: false,
        }),
      ],
    },
    (base) =>
      standardPath({
        edfiTenant: base.edfiTenant,
        teamId: base.teamId,
        kebabCaseName: 'claimset',
        adminApi: true,
        id: `copy`,
      })
  )
  .delete('delete')
  .build();

export const vendorQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Vendor',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetVendorDtoV3 })
  .getAll('getAll', { ResDto: GetVendorDtoV3 })
  .put('put', { ResDto: GetVendorDtoV3, ReqDto: PutVendorDtoV3 })
  .post('post', { ResDto: Id, ReqDto: PostVendorDtoV3 })
  .delete('delete')
  .build();

export const profileQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Profile',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetProfileDtoV3 })
  .getAll('getAll', { ResDto: GetProfileDtoV3 })
  .put('put', { ResDto: GetProfileDtoV3, ReqDto: PutProfileDtoV3 })
  .post('post', { ResDto: GetProfileDtoV3, ReqDto: PostProfileDtoV3 })
  .delete('delete')
  .build();

export const odsInstancesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Odsinstance',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetOdsInstanceSummaryDtoV3 })
  .build();
