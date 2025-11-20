import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { BaseMgmtServiceV2 } from './base-mgmt-service';

export class OdsMgmtServiceV2 extends BaseMgmtServiceV2 {
  constructor() {
    super('odsManagementFunctionArn');
  }

  async add(
    sbEnvironment: SbEnvironment,
    edfiTenant: Pick<EdfiTenant, 'name'>,
    name: string,
    templateName: string
  ) {
    const result = await this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Add',
      TenantName: edfiTenant.name,
      ODSName: name,
      TemplateName: templateName,
    });
    if (
      result.status === 'FAILURE' &&
      result?.data?.errorMessage?.includes(`already exists for tenant`) // TODO: make sure this is the actual failure response
    ) {
      return {
        status: 'ALREADY_EXISTS' as const,
        data: undefined,
      };
    }
    return result;
  }
  async remove(sbEnvironment: SbEnvironment, edfiTenant: Pick<EdfiTenant, 'name'>, name: string) {
    return this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Remove',
      TenantName: edfiTenant.name,
      ODSName: name,
    });
  }
  async listTemplates(sbEnvironment: SbEnvironment) {
    return this.executeMgmtFunction<string[]>(sbEnvironment, {
      Action: 'ListTemplates',
    });
  }
}
