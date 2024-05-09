import { SbEnvironment } from '@edanalytics/models-server';
import { BaseMgmtServiceV2 } from './base-mgmt-service';
import { ISbEnvironmentConfigPublicV2, PostEdfiTenantDto } from '@edanalytics/models';

export class TenantMgmtServiceV2 extends BaseMgmtServiceV2 {
  constructor() {
    super('tenantManagementFunctionArn');
  }

  async add(sbEnvironment: SbEnvironment, tenant: PostEdfiTenantDto) {
    const result = await this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Add',
      TenantName: tenant.name,
      AllowedEdOrgs: tenant.allowedEdorgs
        ? tenant.allowedEdorgs
            .split(/[\s,]+/)
            .map((s) => parseInt(s, 10))
            .filter((n) => !isNaN(n))
        : undefined,
    });
    if (result.status === 'FAILURE' && result?.data?.startsWith(`"Error: Tenant with name `)) {
      return {
        status: 'ALREADY_EXISTS' as const,
      };
    }
    if (result.status === 'FAILURE' && result?.data?.includes('enant name cannot be')) {
      return {
        status: 'INVALID_NAME' as const,
        error: result.data as string,
      };
    }
    return result;
  }
  async remove(sbEnvironment: SbEnvironment, name: string) {
    const result = await this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Remove',
      TenantName: name,
    });

    if (result.status === 'FAILURE' && result?.data?.errorMessage.includes('does not exist.')) {
      return {
        status: 'NOT_FOUND' as const,
      };
    }
    return result;
  }
  async list(sbEnvironment: SbEnvironment) {
    return this.executeMgmtFunction<{ Name: string; AllowedEdOrgs?: number[] }[]>(sbEnvironment, {
      Action: 'List',
    });
  }
  async keygen(sbEnvironment: SbEnvironment, name: string) {
    const result = await this.executeMgmtFunction<
      {
        ClientId: string;
        ClientSecret: string;
      },
      { errorMessage: 'Tenant does not exist' }
    >(sbEnvironment, {
      Action: 'Keygen',
      TenantName: name,
      DisplayName: `SBAA-${
        // the lambda overwrites creds if DisplayName is already taken, so need it to be unique per deployment/sb-environment
        (sbEnvironment.configPublic?.values as ISbEnvironmentConfigPublicV2)?.adminApiUuid
      }`,
    });
    if (result.status === 'SUCCESS') {
      return {
        status: 'SUCCESS' as const,
        data: result.data,
      };
    }
    return result;
  }
  async reload(sbEnvironment: SbEnvironment) {
    return this.executeMgmtFunction<string>(sbEnvironment, {
      Action: 'Reload',
    });
  }
}
