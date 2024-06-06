import { AddEdorgDtoV2 } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { BaseMgmtServiceV2 } from './base-mgmt-service';

export class EdorgMgmtServiceV2 extends BaseMgmtServiceV2 {
  constructor() {
    super('edorgManagementFunctionArn');
  }

  async add(
    sbEnvironment: SbEnvironment,
    edfiTenant: Pick<EdfiTenant, 'name'>,
    dto: AddEdorgDtoV2
  ) {
    //throw error before sending to lambda function
    if (Number(dto.EdOrgId) > Number.MAX_SAFE_INTEGER) {
      throw new Error('Too-big educationOrganizationId encountered');
    }
    const result = await this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Add',
      TenantName: edfiTenant.name,
      ...dto,
    });
    if (result.status === 'FAILURE' && result?.data?.errorMessage?.includes(`already exists`)) {
      return {
        status: 'ALREADY_EXISTS' as const,
        data: undefined,
      };
    }
    return result;
  }

  async remove(
    sbEnvironment: SbEnvironment,
    edfiTenant: Pick<EdfiTenant, 'name'>,
    odsName: string,
    educationOrganizationId: string
  ) {
    return this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Remove',
      TenantName: edfiTenant.name,
      ODSName: odsName,
      EdOrgId: educationOrganizationId,
    });
  }
}
