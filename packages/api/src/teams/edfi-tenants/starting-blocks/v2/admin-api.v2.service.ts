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
    const DisplayName = `Ed-Fi Admin App ${Number(new Date())}ms`;
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
        this.logger.error(
          `Unable to create client on ${edfiTenant.sbEnvironment.adminApiUrl}: ${err}`
        );
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
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`actions?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting actions for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getApplications(edfiTenant: EdfiTenant) {
    return toGetApplicationDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`applications?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting applications for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postApplication(edfiTenant: EdfiTenant, application: PostApplicationDtoV2) {
    return toPostApplicationResponseDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(`applications`, application)
        .catch((err) => {
          this.logger.error(`Error creating application for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async getApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApplicationDtoV2(
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
    application: PutApplicationDtoV2
  ) {
    return toGetApplicationDtoV2(
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

  async putApplicationResetCredential(edfiTenant: EdfiTenant, applicationId: number) {
    return toPostApplicationResponseDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .put(`applications/${applicationId}/reset-credential`)
        .catch((err) => {
          this.logger.error(
            `Error resetting application credential for application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async getAuthorizationStrategies(edfiTenant: EdfiTenant) {
    return toGetAuthStrategyDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`authorizationStrategies?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(
            `Error getting authorization strategies for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getClaimsets(edfiTenant: EdfiTenant) {
    return toGetClaimsetMultipleDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`claimSets?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting claimsets for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postClaimset(edfiTenant: EdfiTenant, claimSet: PostClaimsetDtoV2) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(`claimSets`, claimSet)
        .catch((err) => {
          this.logger.error(`Error creating claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async getClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV2(
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

  async putClaimset(edfiTenant: EdfiTenant, claimSetId: number, claimSet: PutClaimsetDtoV2) {
    return toGetClaimsetSingleDtoV2(
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

  async postClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimAction: PostClaimsetResourceClaimActionsDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(`claimSets/${claimSetId}/resourceClaimActions`, resourceClaimAction)
        .catch((err) => {
          this.logger.error(
            `Error creating claimset ${claimSetId} resource claim action for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number,
    resourceClaimAction: PutClaimsetResourceClaimActionsDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .put(`claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}`, resourceClaimAction)
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${claimSetId} resource claim action for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async postOverrideAuthorizationStrategy(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number,
    overrideAuthorizationStrategy: PostActionAuthStrategiesDtoV2
  ) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(
          `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}/overrideAuthorizationStrategy`,
          overrideAuthorizationStrategy
        )
        .catch((err) => {
          this.logger.error(
            `Error updating claimset ${claimSetId} resource claim ${resourceClaimId} action for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async resetAuthorizationStrategies(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number
  ) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(
          `claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}/resetAuthorizationStrategies`
        )
        .catch((err) => {
          this.logger.error(
            `Error resetting authorization strategies for resourceClaimId ${resourceClaimId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteClaimsetResourceClaimAction(
    edfiTenant: EdfiTenant,
    claimSetId: number,
    resourceClaimId: number
  ) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .delete(`claimSets/${claimSetId}/resourceClaimActions/${resourceClaimId}`)
        .catch((err) => {
          this.logger.error(
            `Error deleting claimset ${claimSetId} resource claim action ${resourceClaimId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async copyClaimset(edfiTenant: EdfiTenant, copyClaimset: CopyClaimsetDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/copy`, copyClaimset)
      .catch((err) => {
        this.logger.error(`Error copying claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async importClaimset(edfiTenant: EdfiTenant, importClaimset: ImportClaimsetSingleDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`claimSets/import`, importClaimset)
      .catch((err) => {
        this.logger.error(`Error importing claimset for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return new Id(Number(headers.location.match(/\d+$/)[0]));
  }

  async exportClaimset(edfiTenant: EdfiTenant, claimSetId: number) {
    return toGetClaimsetSingleDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .get(`claimSets/${claimSetId}/export`)
        .catch((err) => {
          this.logger.error(`Error exporting claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async getOdsInstances(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceSummaryDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`odsInstances?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting ODS instances for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postOdsInstance(edfiTenant: EdfiTenant, odsInstance: PostOdsInstanceDtoV2) {
    return toGetOdsInstanceDetailDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(`odsInstances`, odsInstance)
        .catch((err) => {
          this.logger.error(`Error creating ODS instance for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async getOdsInstance(edfiTenant: EdfiTenant, odsInstanceId: number) {
    return toGetOdsInstanceDetailDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .get(`odsInstances/${odsInstanceId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putOdsInstance(
    edfiTenant: EdfiTenant,
    odsInstanceId: number,
    odsInstance: PutOdsInstanceDtoV2
  ) {
    return toGetOdsInstanceDetailDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .put(`odsInstances/${odsInstanceId}`, odsInstance)
        .catch((err) => {
          this.logger.error(
            `Error updating ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteOdsInstance(edfiTenant: EdfiTenant, odsInstanceId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`odsInstances/${odsInstanceId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting ODS instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getOdsInstanceApplications(edfiTenant: EdfiTenant, odsInstanceId: number) {
    return toGetApplicationDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`odsInstances/${odsInstanceId}/applications?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(
            `Error getting applications for ODS Instance ${odsInstanceId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async getOdsInstanceContexts(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceContextDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`odsInstanceContexts?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance contexts for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async postOdsInstanceContext(
    edfiTenant: EdfiTenant,
    odsInstanceContext: PostOdsInstanceContextDtoV2
  ) {
    return toGetOdsInstanceContextDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(`odsInstanceContexts`, odsInstanceContext)
        .catch((err) => {
          this.logger.error(
            `Error creating ODS instance context for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async getOdsInstanceContext(edfiTenant: EdfiTenant, odsInstanceContextId: number) {
    return toGetOdsInstanceContextDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .get(`odsInstanceContexts/${odsInstanceContextId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance context ${odsInstanceContextId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putOdsInstanceContext(
    edfiTenant: EdfiTenant,
    odsInstanceContextId: number,
    odsInstanceContext: PutOdsInstanceContextDtoV2
  ) {
    return toGetOdsInstanceContextDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .put(`odsInstanceContexts/${odsInstanceContextId}`, odsInstanceContext)
        .catch((err) => {
          this.logger.error(
            `Error updating ODS instance context ${odsInstanceContextId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteOdsInstanceContext(edfiTenant: EdfiTenant, odsInstanceContextId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`odsInstanceContexts/${odsInstanceContextId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting ODS instance context ${odsInstanceContextId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getOdsInstanceDerivatives(edfiTenant: EdfiTenant) {
    return toGetOdsInstanceDerivativeDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`odsInstanceDerivatives?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance derivatives for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }

  async postOdsInstanceDerivative(
    edfiTenant: EdfiTenant,
    odsInstanceDerivative: PostOdsInstanceDerivativeDtoV2
  ) {
    return toGetOdsInstanceDerivativeDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .post(`odsInstanceDerivatives`, odsInstanceDerivative)
        .catch((err) => {
          this.logger.error(
            `Error creating ODS instance derivative for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async getOdsInstanceDerivative(edfiTenant: EdfiTenant, odsInstanceDerivativeId: number) {
    return toGetOdsInstanceDerivativeDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .get(`odsInstanceDerivatives/${odsInstanceDerivativeId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting ODS instance derivative ${odsInstanceDerivativeId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async putOdsInstanceDerivative(
    edfiTenant: EdfiTenant,
    odsInstanceDerivativeId: number,
    odsInstanceDerivative: PutOdsInstanceDerivativeDtoV2
  ) {
    return toGetOdsInstanceDerivativeDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .put(`odsInstanceDerivatives/${odsInstanceDerivativeId}`, odsInstanceDerivative)
        .catch((err) => {
          this.logger.error(
            `Error updating ODS instance derivative ${odsInstanceDerivativeId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async deleteOdsInstanceDerivative(edfiTenant: EdfiTenant, odsInstanceDerivativeId: number) {
    await this.getAdminApiClient(edfiTenant)
      .delete(`odsInstanceDerivatives/${odsInstanceDerivativeId}`)
      .catch((err) => {
        this.logger.error(
          `Error deleting ODS instance derivative ${odsInstanceDerivativeId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
    return undefined;
  }

  async getProfiles(edfiTenant: EdfiTenant) {
    return toGetProfileDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`profiles?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting profiles for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postProfile(edfiTenant: EdfiTenant, profile: PostProfileDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`profiles`, profile)
      .catch((err) => {
        this.logger.error(`Error creating profile for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getProfile(edfiTenant: EdfiTenant, profileId: number) {
    return toGetProfileDtoV2(
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

  async putProfile(edfiTenant: EdfiTenant, profileId: number, profile: PutProfileDtoV2) {
    return toGetProfileDtoV2(
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

  async getResourceClaims(edfiTenant: EdfiTenant) {
    return toGetResourceClaimDetailDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`resourceClaims?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting resource claims for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getResourceClaim(edfiTenant: EdfiTenant, resourceClaimId: number) {
    return toGetResourceClaimDetailDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .get(`resourceClaims/${resourceClaimId}`)
        .catch((err) => {
          this.logger.error(
            `Error getting resource claim ${resourceClaimId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })) as any
    );
  }

  async getVendors(edfiTenant: EdfiTenant) {
    return toGetVendorDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`vendors?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(`Error getting vendors for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async postVendor(edfiTenant: EdfiTenant, vendor: PostVendorDtoV2) {
    const { headers } = await this.getAdminApiClient(edfiTenant, true)
      .post(`vendors`, vendor)
      .catch((err) => {
        this.logger.error(`Error creating vendor for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return { id: Number(headers.location.match(/\d+$/)[0]) };
  }

  async getVendor(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetVendorDtoV2(
      (await this.getAdminApiClient(edfiTenant)
        .get(`vendors/${vendorId}`)
        .catch((err) => {
          this.logger.error(`Error getting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })) as any
    );
  }

  async putVendor(edfiTenant: EdfiTenant, vendorId: number, vendor: PutVendorDtoV2) {
    return toGetVendorDtoV2(
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

  async getVendorApplications(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetApplicationDtoV2(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`vendors/${vendorId}/applications?offset=0&limit=10000`)
        .catch((err) => {
          this.logger.error(
            `Error getting vendor applications for vendor ${vendorId} and tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }
}
