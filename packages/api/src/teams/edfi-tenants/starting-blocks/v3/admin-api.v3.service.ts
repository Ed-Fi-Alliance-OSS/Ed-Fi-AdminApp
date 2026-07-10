import {
  CopyClaimsetDtoV3,
  ISbEnvironmentConfigPrivateV2,
  Id,
  ImportClaimsetSingleDtoV3,
  PostApiClientDtoV3,
  PostApiClientResponseDtoV3,
  PostApplicationDtoV3,
  PostClaimsetDtoV3,
  PostProfileDtoV3,
  PostVendorDtoV3,
  PutApiClientDtoV3,
  PutApplicationDtoV3,
  PutClaimsetDtoV3,
  PutProfileDtoV3,
  PutVendorDtoV3,
  toGetApiClientDtoV3,
  toGetApplicationDtoV3,
  toGetClaimsetMultipleDtoV3,
  toGetClaimsetSingleDtoV3,
  toGetDataStoreSummaryDtoV3,
  toGetProfileDtoV3,
  toGetVendorDtoV3,
  toPostApiClientResponseDtoV3,
  toPostApplicationResponseDtoV3,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import NodeCache from 'node-cache';
import { CustomHttpException } from '../../../../utils';
import { adminApiLoginStatusMsgs } from '../../adminApiLoginFailureMsgs';

/**
 * This service is used to interact with the Admin API V3. Each method is a
 * single API call (plus login if token is expired).
 *
 * Each call uses the `getAdminApiClient` method, which throws explicit HTTP
 * 500s and doesn't leak any internal exceptions. So any Axios errors (e.g.
 * 404) or other non-Nest exceptions encountered externally can be assumed
 * to have arisen in the actual call of interest.
 *
 * `ISbEnvironmentConfigPrivateV2` is intentionally reused here (not
 * duplicated as a "V3" type) — the private credential-storage shape
 * (`{ tenants: Record<string, { adminApiSecret }> }`) is identical between
 * V2 and V3 environments.
 */
@Injectable()
export class AdminApiServiceV3 {
  private adminApiTokens: NodeCache;
  private readonly logger = new Logger(AdminApiServiceV3.name);

  constructor() {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  /**
   * Generate a composite token key for tenant-specific authentication
   * This ensures each tenant has its own token in the cache
   */
  private getTenantTokenKey(environmentId: number, tenantName: string): string {
    return `${environmentId}-${tenantName}`;
  }

  async login(sbEnvironment: SbEnvironment, id: number, tenantName?: string) {
    const configPublic = sbEnvironment.configPublic;
    const configPrivate = sbEnvironment.configPrivate;
    const v3Config =
      'version' in configPublic && configPublic.version === 'v3' ? configPublic.values : undefined;
    const v3ConfigPrivate =
      'version' in configPublic && configPublic.version === 'v3'
        ? (configPrivate as ISbEnvironmentConfigPrivateV2)
        : undefined;

    if (!v3Config || !v3ConfigPrivate) {
      return {
        status: 'NO_CONFIG' as const,
      };
    }

    // If no tenant name provided, try to find the first available tenant credentials
    // This is needed for initial tenant discovery in EdFi environments
    if (!tenantName) {
      const availableTenants = v3Config.tenants ? Object.keys(v3Config.tenants) : [];

      if (availableTenants.length === 0) {
        return {
          status: 'NO_TENANT_CONFIG' as const,
        };
      }

      // Prefer 'default' tenant if available, otherwise use first tenant
      tenantName = availableTenants.includes('default')
        ? 'default'
        : availableTenants[0];

      this.logger.log(`No tenant specified for login, using tenant: ${tenantName}`);
    }

    if (!v3Config?.tenants[tenantName] || !v3ConfigPrivate?.tenants[tenantName]) {
      return {
        status: 'NO_TENANT_CONFIG' as const,
      };
    }
    const adminApiUrl = sbEnvironment.adminApiUrl;
    const adminApiKey = v3Config?.tenants[tenantName]?.adminApiKey;
    const adminApiSecret = v3ConfigPrivate?.tenants[tenantName]?.adminApiSecret;

    if (typeof adminApiUrl !== 'string') {
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }
    if (typeof adminApiKey !== 'string') {
      return {
        status: 'NO_ADMIN_API_KEY' as const,
      };
    }
    if (typeof adminApiSecret !== 'string') {
      return {
        status: 'NO_ADMIN_API_SECRET' as const,
      };
    }
    let accessTokenUri = '';
    try {
      const url = new URL(adminApiUrl);
      url.pathname = url.pathname.replace(/\/$/, '') + '/connect/token';
      accessTokenUri = url.toString();
    } catch (InvalidUrl) {
      this.logger.log(InvalidUrl);
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }

    const reqBody = new URLSearchParams();
    reqBody.set('client_id', adminApiKey);
    reqBody.set('client_secret', adminApiSecret);
    reqBody.set('grant_type', 'client_credentials');
    reqBody.set('scope', 'edfi_admin_api/full_access');

    const options = {
      method: 'POST',
      url: accessTokenUri,
      headers: {
        Accept: 'application/json',
        tenant: tenantName,
      },
      data: reqBody,
    };

    try {
      await axios.request(options).then((v) => {
        // Store token with tenant-specific composite key
        const tokenKey = this.getTenantTokenKey(id, tenantName);
        this.adminApiTokens.set(tokenKey, v.data.access_token, Number(v.data.expires_in) - 60);
        this.logger.log(`Stored token for environment ${id} tenant ${tenantName} at key: ${tokenKey}`);
      });
      return {
        status: 'SUCCESS' as const,
      };
    } catch (LoginFailed) {
      if (LoginFailed?.code === 'ERR_HTTP2_GOAWAY_SESSION') {
        return {
          status: 'GOAWAY' as const, // TBD what to do about this
        };
      } else if (isAxiosError(LoginFailed) && LoginFailed.response?.status === 404) {
        return {
          status: 'TOKEN_URI_NOT_FOUND' as const,
        };
      } else if (isAxiosError(LoginFailed) && LoginFailed.response?.status === 401) {
        return {
          status: 'INVALID_CREDS' as const,
        };
      }
      this.logger.warn(LoginFailed);
      this.logger.log({
        accessTokenUri: accessTokenUri,
        adminApiKey: adminApiKey?.length,
        adminApiSecret: adminApiSecret?.length,
      });
      return {
        status: 'LOGIN_FAILED' as const,
      };
    }
  }

  /**
   * Get an authenticated API client for a specific tenant.
   *
   * @param edfiTenant - The tenant to get the client for
   * @param notJustData - Whether to return full response or just data
   * @returns Axios instance configured with tenant authentication
   */
  public getAdminApiClient(edfiTenant: EdfiTenant, notJustData?: boolean) {
    const client = this.initializeApiClient(edfiTenant.sbEnvironment, notJustData);
    client.interceptors.request.use(async (config) => {
      // Use composite key for tenant-specific token retrieval
      const tokenKey = this.getTenantTokenKey(edfiTenant.sbEnvironment.id, edfiTenant.name);
      let token: undefined | string = this.adminApiTokens.get(tokenKey);
      if (token === undefined) {
        this.logger.log(`No cached token found for tenant ${edfiTenant.name}, attempting login...`);
        const adminLogin = await this.login(edfiTenant.sbEnvironment, edfiTenant.sbEnvironment.id, edfiTenant.name);

        if (adminLogin.status !== 'SUCCESS') {
          const errorMsg = adminApiLoginStatusMsgs[adminLogin.status];
          this.logger.error(
            `Authentication failed for tenant ${edfiTenant.name}: ${adminLogin.status} - ${errorMsg}`
          );
          throw new CustomHttpException(
            {
              title: `Authentication failed for tenant ${edfiTenant.name}`,
              type: 'Error',
              message: `${adminLogin.status}: ${errorMsg}`,
            },
            500
          );
        }
        token = this.adminApiTokens.get(tokenKey);
        this.logger.log(`Successfully authenticated tenant ${edfiTenant.name}`);
      }
      config.headers.Authorization = `Bearer ${token}`;
      config.headers.tenant = edfiTenant.name;
      return config;
    });
    return client;
  }

  private initializeApiClient(environment: SbEnvironment, notJustData: boolean) {
    const client = axios.create({
      baseURL: environment.adminApiUrl.replace(/\/$/, '') + '/v3/',
    });
    client.interceptors.response.use(
      notJustData
        ? (value) => value
        : (value) => {
          return value.data;
        },
      (err) => {
        this.logger.error(
          `Unable to create client on ${environment.adminApiUrl}: ${err}`
        );
        throw err;
      }
    );
    return client;
  }

  //
  // Applications
  //

  async getApplications(edfiTenant: EdfiTenant) {
    return toGetApplicationDtoV3(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`applications?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting applications for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postApplication(edfiTenant: EdfiTenant, application: PostApplicationDtoV3) {
    return toPostApplicationResponseDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .post(`applications`, application)
        .catch((err) => {
          this.logger.error(`Error creating application for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async getApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApplicationDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .get(`applications/${applicationId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putApplication(
    edfiTenant: EdfiTenant,
    applicationId: number,
    application: PutApplicationDtoV3
  ) {
    return toGetApplicationDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .put(`applications/${applicationId}`, application)
        .catch((err) => {
          this.logger.error(
            `Error updating application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteApplication(edfiTenant: EdfiTenant, applicationId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`applications/${applicationId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  //
  // Api Clients
  //

  async getApiClients(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApiClientDtoV3(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`apiclients?offset=0&limit=10000&applicationId=${applicationId}`)
        .catch((err) => {
          this.logger.error(`Error getting API clients for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getApiClient(edfiTenant: EdfiTenant, apiClientId: number) {
    return toGetApiClientDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .get(`apiclients/${apiClientId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putApiClient(edfiTenant: EdfiTenant, apiClientId: number, apiClient: PutApiClientDtoV3) {
    return toGetApiClientDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .put(`apiclients/${apiClientId}`, apiClient)
        .catch((err) => {
          this.logger.error(
            `Error updating API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async postApiClient(
    edfiTenant: EdfiTenant,
    apiClient: PostApiClientDtoV3
  ): Promise<PostApiClientResponseDtoV3> {
    return toPostApiClientResponseDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .post(`apiclients`, apiClient)
        .catch((err) => {
          this.logger.error(`Error creating API client for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async putApiClientResetCredential(edfiTenant: EdfiTenant, apiClientId: number) {
    return toPostApiClientResponseDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .put(`apiclients/${apiClientId}/reset-credential`)
        .catch((err) => {
          this.logger.error(
            `Error resetting API client credential for API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteApiClient(edfiTenant: EdfiTenant, apiClientId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`apiclients/${apiClientId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting API client ${apiClientId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  //
  // Claimsets
  //

  async getClaimsets(edfiTenant: EdfiTenant) {
    return toGetClaimsetMultipleDtoV3(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`claimSets?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting claimsets for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postClaimset(edfiTenant: EdfiTenant, claimSet: PostClaimsetDtoV3) {
    return toGetClaimsetSingleDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .post(`claimSets`, claimSet)
        .catch((err) => {
          this.logger.error(`Error creating claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async getClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .get(`claimSets/${claimSetId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting claimset ${claimSetId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putClaimset(edfiTenant: EdfiTenant, claimSetId: number, claimSet: PutClaimsetDtoV3) {
    return toGetClaimsetSingleDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .put(`claimSets/${claimSetId}`, claimSet)
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${claimSetId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`claimSets/${claimSetId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting claimset ${claimSetId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async copyClaimset(edfiTenant: EdfiTenant, copyClaimset: CopyClaimsetDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/copy`, copyClaimset)
      .catch((err) => {
        this.logger.error(`Error copying claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async importClaimset(edfiTenant: EdfiTenant, importClaimset: ImportClaimsetSingleDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/import`, importClaimset)
      .catch((err) => {
        this.logger.error(`Error importing claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async exportClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .get(`claimSets/${claimSetId}/export`)
        .catch((err) => {
          this.logger.error(`Error exporting claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  //
  // Data Stores (renamed from V2's "ODS Instances")
  //

  async getDataStores(edfiTenant: EdfiTenant) {
    return toGetDataStoreSummaryDtoV3(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`dataStores?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting data stores for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  //
  // Profiles
  //

  async getProfiles(edfiTenant: EdfiTenant) {
    return toGetProfileDtoV3(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`profiles?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting profiles for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postProfile(edfiTenant: EdfiTenant, profile: PostProfileDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`profiles`, profile)
      .catch((err) => {
        this.logger.error(`Error creating profile for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getProfile(edfiTenant: EdfiTenant, profileId: number) {
    return toGetProfileDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .get(`profiles/${profileId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting profile ${profileId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putProfile(edfiTenant: EdfiTenant, profileId: number, profile: PutProfileDtoV3) {
    return toGetProfileDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .put(`profiles/${profileId}`, profile)
        .catch((err) => {
          this.logger.error(
            `Error updating profile ${profileId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteProfile(edfiTenant: EdfiTenant, profileId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`profiles/${profileId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting profile ${profileId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  //
  // Vendors
  //

  async getVendors(edfiTenant: EdfiTenant) {
    return toGetVendorDtoV3(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`vendors?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting vendors for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postVendor(edfiTenant: EdfiTenant, vendor: PostVendorDtoV3) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`vendors`, vendor)
      .catch((err) => {
        this.logger.error(`Error creating vendor for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getVendor(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetVendorDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .get(`vendors/${vendorId}`)
        .catch((err) => {
          this.logger.error(`Error getting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async putVendor(edfiTenant: EdfiTenant, vendorId: number, vendor: PutVendorDtoV3) {
    return toGetVendorDtoV3(
      (await this.getAdminApiClient(edfiTenant)
        .put(`vendors/${vendorId}`, vendor)
        .catch((err) => {
          this.logger.error(
            `Error updating vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteVendor(edfiTenant: EdfiTenant, vendorId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`vendors/${vendorId}`)
      .catch((err) => {
        this.logger.error(`Error deleting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return undefined;
  }
}
