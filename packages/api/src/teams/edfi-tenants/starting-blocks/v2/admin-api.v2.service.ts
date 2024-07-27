import {
  CopyClaimsetDtoV2,
  ISbEnvironmentConfigPrivateV2,
  Id,
  ImportClaimsetSingleDtoV2,
  PostActionAuthStrategiesDtoV2,
  PostApplicationDtoV2,
  PostClaimsetDtoV2,
  PostClaimsetResourceClaimActionsDtoV2,
  PostOdsInstanceContextDtoV2,
  PostOdsInstanceDerivativeDtoV2,
  PostOdsInstanceDtoV2,
  PostProfileDtoV2,
  PostVendorDtoV2,
  PutApplicationDtoV2,
  PutClaimsetDtoV2,
  PutClaimsetResourceClaimActionsDtoV2,
  PutOdsInstanceContextDtoV2,
  PutOdsInstanceDerivativeDtoV2,
  PutOdsInstanceDtoV2,
  PutProfileDtoV2,
  PutVendorDtoV2,
  toGetActionDtoV2,
  toGetApplicationDtoV2,
  toGetAuthStrategyDtoV2,
  toGetClaimsetMultipleDtoV2,
  toGetClaimsetSingleDtoV2,
  toGetOdsInstanceContextDtoV2,
  toGetOdsInstanceDerivativeDtoV2,
  toGetOdsInstanceDetailDtoV2,
  toGetOdsInstanceSummaryDtoV2,
  toGetProfileDtoV2,
  toGetResourceClaimDetailDtoV2,
  toGetVendorDtoV2,
  toPostApplicationResponseDtoV2,
} from '@edanalytics/models';
import { EdfiTenant } from '@edanalytics/models-server';
import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, isAxiosError } from 'axios';
import crypto from 'crypto';
import NodeCache from 'node-cache';
import { CustomHttpException } from '../../../../utils';
import { StartingBlocksServiceV2 } from './starting-blocks.v2.service';
import { adminApiLoginStatusMsgs } from '../../adminApiLoginFailureMsgs';
/**
 * This service is used to interact with the Admin API. Each method is a single
 * API call (plus login if token is expired).
 *
 * Each call uses the `getAdminApiClient` method, which throws explicit HTTP 500s
 * and doesn't leak any internal exceptions. So any Axios errors (e.g. 404) or
 * other non-Nest exceptions encountered externally can be assumed to have arisen
 * in the actual call of interest.
 */
@Injectable()
export class AdminApiServiceV2 {
  private adminApiTokens: NodeCache;
  private readonly logger = new Logger(AdminApiServiceV2.name);

  constructor(
    @Inject(StartingBlocksServiceV2) private startingBlocksService: StartingBlocksServiceV2
  ) {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  async login(edfiTenant: EdfiTenant) {
    const configPublic = edfiTenant.sbEnvironment.configPublic;
    const configPrivate = edfiTenant.sbEnvironment.configPrivate;
    const v2Config =
      'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;
    const v2ConfigPrivate =
      'version' in configPublic && configPublic.version === 'v2'
        ? (configPrivate as ISbEnvironmentConfigPrivateV2)
        : undefined;

    if (!v2Config || !v2ConfigPrivate) {
      return {
        status: 'NO_CONFIG' as const,
      };
    }
    if (!v2Config?.tenants[edfiTenant.name] || !v2ConfigPrivate?.tenants[edfiTenant.name]) {
      return {
        status: 'NO_TENANT_CONFIG' as const,
      };
    }
    const adminApiUrl = edfiTenant.sbEnvironment.adminApiUrl;
    const adminApiKey = v2Config?.tenants[edfiTenant.name]?.adminApiKey;
    const adminApiSecret = v2ConfigPrivate?.tenants[edfiTenant.name]?.adminApiSecret;

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
        tenant: edfiTenant.name,
      },
      data: reqBody,
    };

    try {
      await axios.request(options).then((v) => {
        this.adminApiTokens.set(edfiTenant.id, v.data.access_token, Number(v.data.expires_in) - 60);
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

  async selfRegisterAdminApi(edfiTenant: EdfiTenant) {
    const configPublic = edfiTenant.sbEnvironment.configPublic;
    const v2Config =
      'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;

    if (!v2Config) {
      return {
        status: 'NO_CONFIG' as const,
      };
    }
    const adminApiUrl = edfiTenant.sbEnvironment.adminApiUrl;

    if (typeof adminApiUrl !== 'string') {
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }
    let registrationUri = '';
    try {
      const url = new URL(adminApiUrl);
      url.pathname = url.pathname.replace(/\/$/, '') + '/connect/token';
      registrationUri = url.toString();
    } catch (InvalidUrl) {
      this.logger.log(InvalidUrl);
      return {
        status: 'INVALID_ADMIN_API_URL' as const,
      };
    }
    const ClientId = crypto.randomBytes(16).toString('hex');
    const ClientSecret = crypto.randomBytes(128).toString('base64');
    const DisplayName = `SBAA ${Number(new Date())}ms`;
    const credentials = {
      ClientId,
      ClientSecret,
      DisplayName,
    };

    return (
      axios
        .post(registrationUri, credentials, {
          headers: { 'content-type': 'application/x-www-form-urlencoded', tenant: edfiTenant.name },
        })
        .then(async () => {
          await this.startingBlocksService.saveAdminApiCredentials(
            edfiTenant,
            edfiTenant.sbEnvironment,
            credentials
          );
          return { status: 'SUCCESS' as const };
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: AxiosError<any>) => {
          if (err.response?.data?.errors) {
            this.logger.warn(JSON.stringify(err.response.data.errors));
            return {
              status: 'ERROR' as const,
              data: err.response.data as object,
            };
          } else if (err?.code === 'ENOTFOUND') {
            this.logger.warn('Attempted to register Admin API but ENOTFOUND: ' + registrationUri);
            return {
              status: 'ENOTFOUND' as const,
            };
          } else {
            this.logger.warn(err);
            return {
              status: 'ERROR' as const,
            };
          }
        })
    );
  }

  private getAdminApiClient(edfiTenant: EdfiTenant, notJustData?: boolean) {
    const client = axios.create({
      baseURL: edfiTenant.sbEnvironment.adminApiUrl.replace(/\/$/, '') + '/v2/',
    });
    client.interceptors.response.use(
      notJustData
        ? (value) => value
        : (value) => {
            return value.data;
          },
      (err) => {
        if (err.response?.status === 401) {
          this.adminApiTokens.del(edfiTenant.id);
        }
        this.logger.error(err);
        throw err;
      }
    );
    client.interceptors.request.use(async (config) => {
      let token: undefined | string = this.adminApiTokens.get(edfiTenant.id);
      if (token === undefined) {
        const adminLogin = await this.login(edfiTenant);

        if (adminLogin.status !== 'SUCCESS') {
          throw new CustomHttpException(
            {
              title: adminApiLoginStatusMsgs[adminLogin.status],
              type: 'Error',
            },
            500
          );
        }
        token = this.adminApiTokens.get(edfiTenant.id);
      }
      config.headers.Authorization = `Bearer ${token}`;
      config.headers.tenant = edfiTenant.name;
      return config;
    });
    return client;
  }

  async getActions(edfiTenant: EdfiTenant) {
    return toGetActionDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(`actions?offset=0&limit=10000`)
    );
  }

  async getApplications(edfiTenant: EdfiTenant) {
    return toGetApplicationDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(`applications?offset=0&limit=10000`)
    );
  }

  async postApplication(edfiTenant: EdfiTenant, application: PostApplicationDtoV2) {
    return toPostApplicationResponseDtoV2(
      await this.getAdminApiClient(edfiTenant).post(`applications`, application)
    );
  }

  async getApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant).get(`applications/${applicationId}`)
    );
  }

  async putApplication(
    edfiTenant: EdfiTenant,
    applicationId: number,
    application: PutApplicationDtoV2
  ) {
    return toGetApplicationDtoV2(
      await this.getAdminApiClient(edfiTenant).put(`applications/${applicationId}`, application)
    );
  }

  async deleteApplication(edfiTenant: EdfiTenant, applicationId: number) {
    await this.getAdminApiClient(edfiTenant).delete(`applications/${applicationId}`);
    return undefined;
  }

  async putApplicationResetCredential(edfiTenant: EdfiTenant, applicationId: number) {
    return toPostApplicationResponseDtoV2(
      await this.getAdminApiClient(edfiTenant).put(`applications/${applicationId}/reset-credential`)
    );
  }

  async getAuthorizationStrategies(edfiTenant: EdfiTenant) {
    return toGetAuthStrategyDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(
        `authorizationStrategies?offset=0&limit=10000`
      )
    );
  }

  async getClaimsets(edfiTenant: EdfiTenant) {
    return toGetClaimsetMultipleDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(`claimSets?offset=0&limit=10000`)
    );
  }

  async postClaimset(edfiTenant: EdfiTenant, claimSet: PostClaimsetDtoV2) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).post(`claimSets`, claimSet)
    );
  }

  async getClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).get(`claimSets/${claimSetId}`)
    );
  }

  async putClaimset(edfiTenant: EdfiTenant, claimSetId: number, claimSet: PutClaimsetDtoV2) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).put(`claimSets/${claimSetId}`, claimSet)
    );
  }

  async deleteClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    await this.getAdminApiClient(edfiTenant).delete(`claimSets/${claimSetId}`);
    return undefined;
  }

  async postClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimAction: PostClaimsetResourceClaimActionsDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).post(
        `claimSets/${claimSetId}/resourceClaimActions`,
        resourceClaimAction
      )
    );
  }

  async putClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number,
    resourceClaimAction: PutClaimsetResourceClaimActionsDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).put(
        `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}`,
        resourceClaimAction
      )
    );
  }

  async postOverrideAuthorizationStrategy(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number,
    overrideAuthorizationStrategy: PostActionAuthStrategiesDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).post(
        `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}/overrideAuthorizationStrategy`,
        overrideAuthorizationStrategy
      )
    );
  }

  async resetAuthorizationStrategies(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).post(
        `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}/resetAuthorizationStrategies`
      )
    );
  }

  async deleteClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number
  ) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).delete(
        `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}`
      )
    );
  }

  async copyClaimset(edfiTenant: EdfiTenant, copyClaimset: CopyClaimsetDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true).post(
      `claimSets/copy`,
      copyClaimset
    );
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async importClaimset(edfiTenant: EdfiTenant, importClaimset: ImportClaimsetSingleDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true).post(
      `claimSets/import`,
      importClaimset
    );
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async exportClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV2(
      await this.getAdminApiClient(edfiTenant).get(`claimSets/${claimSetId}/export`)
    );
  }

  async getOdsInstances(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceSummaryDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(`odsInstances?offset=0&limit=10000`)
    );
  }

  async postOdsInstance(edfiTenant: EdfiTenant, odsInstance: PostOdsInstanceDtoV2) {
    return toGetOdsInstanceDetailDtoV2(
      await this.getAdminApiClient(edfiTenant).post(`odsInstances`, odsInstance)
    );
  }

  async getOdsInstance(edfiTenant: EdfiTenant, odsInstanceId: number) {
    return toGetOdsInstanceDetailDtoV2(
      await this.getAdminApiClient(edfiTenant).get(`odsInstances/${odsInstanceId}`)
    );
  }

  async putOdsInstance(
    edfiTenant: EdfiTenant,
    odsInstanceId: number,
    odsInstance: PutOdsInstanceDtoV2
  ) {
    return toGetOdsInstanceDetailDtoV2(
      await this.getAdminApiClient(edfiTenant).put(`odsInstances/${odsInstanceId}`, odsInstance)
    );
  }

  async deleteOdsInstance(edfiTenant: EdfiTenant, odsInstanceId: number) {
    await this.getAdminApiClient(edfiTenant).delete(`odsInstances/${odsInstanceId}`);
    return undefined;
  }

  async getOdsInstanceApplications(edfiTenant: EdfiTenant, odsInstanceId: number) {
    return toGetApplicationDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(
        `odsInstances/${odsInstanceId}/applications?offset=0&limit=10000`
      )
    );
  }

  async getOdsInstanceContexts(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceContextDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(
        `odsInstanceContexts?offset=0&limit=10000`
      )
    );
  }

  async postOdsInstanceContext(
    edfiTenant: EdfiTenant,
    odsInstanceContext: PostOdsInstanceContextDtoV2
  ) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant).post(`odsInstanceContexts`, odsInstanceContext)
    );
  }

  async getOdsInstanceContext(edfiTenant: EdfiTenant, odsInstanceContextId: number) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant).get(`odsInstanceContexts/${odsInstanceContextId}`)
    );
  }

  async putOdsInstanceContext(
    edfiTenant: EdfiTenant,
    odsInstanceContextId: number,
    odsInstanceContext: PutOdsInstanceContextDtoV2
  ) {
    return toGetOdsInstanceContextDtoV2(
      await this.getAdminApiClient(edfiTenant).put(
        `odsInstanceContexts/${odsInstanceContextId}`,
        odsInstanceContext
      )
    );
  }

  async deleteOdsInstanceContext(edfiTenant: EdfiTenant, odsInstanceContextId: number) {
    await this.getAdminApiClient(edfiTenant).delete(`odsInstanceContexts/${odsInstanceContextId}`);
    return undefined;
  }

  async getOdsInstanceDerivatives(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceDerivativeDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(
        `odsInstanceDerivatives?offset=0&limit=10000`
      )
    );
  }

  async postOdsInstanceDerivative(
    edfiTenant: EdfiTenant,
    odsInstanceDerivative: PostOdsInstanceDerivativeDtoV2
  ) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant).post(`odsInstanceDerivatives`, odsInstanceDerivative)
    );
  }

  async getOdsInstanceDerivative(edfiTenant: EdfiTenant, odsInstanceDerivativeId: number) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant).get(
        `odsInstanceDerivatives/${odsInstanceDerivativeId}`
      )
    );
  }

  async putOdsInstanceDerivative(
    edfiTenant: EdfiTenant,
    odsInstanceDerivativeId: number,
    odsInstanceDerivative: PutOdsInstanceDerivativeDtoV2
  ) {
    return toGetOdsInstanceDerivativeDtoV2(
      await this.getAdminApiClient(edfiTenant).put(
        `odsInstanceDerivatives/${odsInstanceDerivativeId}`,
        odsInstanceDerivative
      )
    );
  }

  async deleteOdsInstanceDerivative(edfiTenant: EdfiTenant, odsInstanceDerivativeId: number) {
    await this.getAdminApiClient(edfiTenant).delete(
      `odsInstanceDerivatives/${odsInstanceDerivativeId}`
    );
    return undefined;
  }

  async getProfiles(edfiTenant: EdfiTenant) {
    return toGetProfileDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(`profiles?offset=0&limit=10000`)
    );
  }

  async postProfile(edfiTenant: EdfiTenant, profile: PostProfileDtoV2) {
    return toGetProfileDtoV2(await this.getAdminApiClient(edfiTenant).post(`profiles`, profile));
  }

  async getProfile(edfiTenant: EdfiTenant, profileId: number) {
    return toGetProfileDtoV2(await this.getAdminApiClient(edfiTenant).get(`profiles/${profileId}`));
  }

  async putProfile(edfiTenant: EdfiTenant, profileId: number, profile: PutProfileDtoV2) {
    return toGetProfileDtoV2(
      await this.getAdminApiClient(edfiTenant).put(`profiles/${profileId}`, profile)
    );
  }

  async deleteProfile(edfiTenant: EdfiTenant, profileId: number) {
    await this.getAdminApiClient(edfiTenant).delete(`profiles/${profileId}`);
    return undefined;
  }

  async getResourceClaims(edfiTenant: EdfiTenant) {
    return toGetResourceClaimDetailDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(
        `resourceClaims?offset=0&limit=10000`
      )
    );
  }

  async getResourceClaim(edfiTenant: EdfiTenant, resourceClaimId: number) {
    return toGetResourceClaimDetailDtoV2(
      await this.getAdminApiClient(edfiTenant).get(`resourceClaims/${resourceClaimId}`)
    );
  }

  async getVendors(edfiTenant: EdfiTenant) {
    return toGetVendorDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(`vendors?offset=0&limit=10000`)
    );
  }

  async postVendor(edfiTenant: EdfiTenant, vendor: PostVendorDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true).post(`vendors`, vendor);
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getVendor(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetVendorDtoV2(await this.getAdminApiClient(edfiTenant).get(`vendors/${vendorId}`));
  }

  async putVendor(edfiTenant: EdfiTenant, vendorId: number, vendor: PutVendorDtoV2) {
    return toGetVendorDtoV2(
      await this.getAdminApiClient(edfiTenant).put(`vendors/${vendorId}`, vendor)
    );
  }

  async deleteVendor(edfiTenant: EdfiTenant, vendorId: number) {
    await this.getAdminApiClient(edfiTenant).delete(`vendors/${vendorId}`);
    return undefined;
  }

  async getVendorApplications(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetApplicationDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant).get<any, any[]>(
        `vendors/${vendorId}/applications?offset=0&limit=10000`
      )
    );
  }
}
