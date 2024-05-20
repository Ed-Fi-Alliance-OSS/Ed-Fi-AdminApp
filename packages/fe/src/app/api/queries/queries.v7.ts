import {
  ApplicationYopassResponseDto,
  CopyClaimsetDtoV2,
  GetApplicationDtoV2,
  GetClaimsetMultipleDtoV2,
  GetClaimsetSingleDtoV2,
  GetVendorDtoV2,
  Id,
  ImportClaimsetSingleDtoV2,
  PostApplicationFormDtoV2,
  PostClaimsetDtoV2,
  PostVendorDtoV2,
  PutApplicationFormDtoV2,
  PutClaimsetFormDtoV2,
  PutVendorDtoV2,
} from '@edanalytics/models';
import { EntityQueryBuilder, queryKeyNew, standardPath } from './builder';
import { TeamOptions } from './queries';

export const applicationQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Application',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getAll('getAll', { ResDto: GetApplicationDtoV2 })
  .getOne('getOne', { ResDto: GetApplicationDtoV2 })
  .put('put', { ResDto: GetApplicationDtoV2, ReqDto: PutApplicationFormDtoV2 })
  .put(
    'resetCreds',
    {
      ResDto: ApplicationYopassResponseDto,
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
  .post('post', { ResDto: ApplicationYopassResponseDto, ReqDto: PostApplicationFormDtoV2 })
  .delete('delete')
  .build();

export const claimsetQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Claimset',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetClaimsetSingleDtoV2 })
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
  .getAll('getAll', { ResDto: GetClaimsetMultipleDtoV2 })
  .put('put', { ResDto: GetClaimsetSingleDtoV2, ReqDto: PutClaimsetFormDtoV2 })
  .post('post', { ResDto: GetClaimsetSingleDtoV2, ReqDto: PostClaimsetDtoV2 })
  .post('import', { ResDto: Id, ReqDto: ImportClaimsetSingleDtoV2 }, (base) =>
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
      ReqDto: CopyClaimsetDtoV2,
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

export const vendorQueriesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Vendor',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetVendorDtoV2 })
  .getAll('getAll', { ResDto: GetVendorDtoV2 })
  .put('put', { ResDto: GetVendorDtoV2, ReqDto: PutVendorDtoV2 })
  .post('post', { ResDto: Id, ReqDto: PostVendorDtoV2 })
  .delete('delete')
  .build();
