import { Expose } from 'class-transformer';
import type { IIntegrationApp, IIntegrationAppDetailed } from '../interfaces';
import {
  DtoPostBase,
  PostDto,
  DtoPutBase,
  PutDto,
  DtoGetBase,
  GetDto,
  makeSerializer,
} from '../utils';

export class GetIntegrationAppDto
  extends DtoGetBase
  implements
    GetDto<
      IIntegrationAppDetailed,
      'applicationName' | 'edfiTenant' | 'integrationProvider' | 'ods' | 'sbEnvironment'
    >
{
  @Expose()
  applicationId: number | null;

  @Expose()
  applicationName: string;

  @Expose()
  edfiTenantId: number;

  @Expose()
  edfiTenantName: string;

  @Expose()
  edorgIds: number[];

  @Expose()
  edorgNames: string[];

  @Expose()
  integrationProviderId: number;

  @Expose()
  integrationProviderName: string;

  @Expose()
  odsId: number;

  @Expose()
  odsName: string;

  @Expose()
  sbEnvironmentId: number;

  @Expose()
  sbEnvironmentName: string;
}

export const toGetIntegrationAppDto = makeSerializer(GetIntegrationAppDto);

export class PutIntegrationAppDto
  extends DtoPutBase
  implements
    PutDto<
      IIntegrationApp,
      | 'applicationId'
      | 'applicationName'
      | 'edfiTenant'
      | 'edfiTenantId'
      | 'edorgIds'
      | 'integrationProvider'
      | 'ods'
      | 'odsId'
      | 'sbEnvironment'
      | 'sbEnvironmentId'
    >
{
  @Expose()
  integrationProviderId: number;
}

export class PostIntegrationAppDto
  extends DtoPostBase
  implements
    PostDto<IIntegrationApp, 'edfiTenant' | 'integrationProvider' | 'ods' | 'sbEnvironment'>
{
  @Expose()
  applicationId: number | null;

  @Expose()
  applicationName: string;

  @Expose()
  edfiTenantId: number;

  @Expose()
  edorgIds: number[];

  @Expose()
  integrationProviderId: number;

  @Expose()
  odsId: number;

  @Expose()
  sbEnvironmentId: number;
}
