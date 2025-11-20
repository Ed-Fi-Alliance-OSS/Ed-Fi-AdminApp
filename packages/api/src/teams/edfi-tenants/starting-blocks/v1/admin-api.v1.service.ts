import {
  GetClaimsetDto,
  ISbEnvironmentConfigPrivateV1,
  PostApplicationDto,
  PostApplicationResponseDto,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
  toGetApplicationDto,
  toGetClaimsetDto,
  toGetVendorDto,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, isAxiosError } from 'axios';
import crypto from 'crypto';
import _ from 'lodash';
import NodeCache from 'node-cache';
import { CustomHttpException } from '../../../../utils';
import { failureBut200Response } from './admin-api-v1x-exception.filter';
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
export class AdminApiServiceV1 {
  adminApiTokens: NodeCache;

  constructor() {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  async logIntoAdminApi(edfiTenant: EdfiTenant) {
    const configPublic = edfiTenant.sbEnvironment.configPublic;
    const configPrivate = edfiTenant.sbEnvironment.configPrivate;
    const v1Config =
      'version' in configPublic && configPublic.version === 'v1' ? configPublic.values : undefined;
    const v1ConfigPrivate =
      'version' in configPublic && configPublic.version === 'v1'
        ? (configPrivate as ISbEnvironmentConfigPrivateV1)
        : undefined;

    const adminApiUrl = edfiTenant.sbEnvironment.adminApiUrl;
    if (typeof adminApiUrl !== 'string') {
      Logger.log('No Admin API URL configured for environment.');
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }
    const adminApiKey = v1Config?.adminApiKey;
    if (typeof adminApiKey !== 'string' || adminApiKey.length === 0) {
      Logger.log('No Admin API key configured for environment.');
      return {
        status: 'NO_ADMIN_API_KEY' as const,
      };
    }
    const adminApiSecret = v1ConfigPrivate?.adminApiSecret;
    if (typeof adminApiSecret !== 'string' || adminApiSecret.length === 0) {
      Logger.log('No Admin API secret configured for environment.');
      return {
        status: 'NO_ADMIN_API_SECRET' as const,
      };
    }
    const accessTokenUri = `${adminApiUrl.replace(/\/$/, '')}/connect/token`;
    try {
      new URL(accessTokenUri);
    } catch (InvalidUrl) {
      Logger.log(InvalidUrl);
      return {
        status: 'INVALID_ADMIN_API_URL' as const,
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
        Logger.warn('ERR_HTTP2_GOAWAY_SESSION');
        Logger.warn(LoginFailed);
        return {
          status: 'GOAWAY' as const, // TBD what this actually means
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
      Logger.warn(LoginFailed);
      return {
        status: 'LOGIN_FAILED' as const,
        message:
          'body' in LoginFailed &&
          'error' in LoginFailed.body &&
          typeof LoginFailed.body.error === 'string'
            ? LoginFailed.body.error
            : 'Unknown login failure.',
      };
    }
  }

  async selfRegisterAdminApi(
    /** Base URL, no `/connect/register` */
    url: string
  ) {
    const ClientId = crypto.randomBytes(12).toString('hex');
    const ClientSecret = crypto.randomBytes(36).toString('hex');
    const DisplayName = `Ed-Fi Admin App ${Number(new Date())}ms`;
    const credentials = {
      ClientId,
      ClientSecret,
      DisplayName,
    };

    return (
      axios
        .post(`${url.replace(/\/$/, '')}/connect/register`, credentials, {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        })
        .then((res) => {
          if (_.isEqual(res.data, failureBut200Response)) {
            // This may be the failure mode when the environment does not allow self-registration. Unclear.
            Logger.warn('Attempted to register Admin API but got 200 with failure response.');
            return {
              status: 'ERROR' as const,
              message:
                'Unspecified error registering Admin API (status code 200 but request body indicates failure).' as const,
            };
          }
          return { credentials, status: 'SUCCESS' as const };
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: AxiosError<any>) => {
          if (err.response?.data?.errors) {
            Logger.warn(JSON.stringify(err.response.data.errors));
            return {
              status: 'ERROR' as const,
              data: err.response.data as object,
            };
          } else if (err?.code === 'ENOTFOUND') {
            Logger.warn('Attempted to register Admin API but ENOTFOUND: ' + url);
            return {
              status: 'ENOTFOUND' as const,
            };
          } else if (isAxiosError(err) && err.response?.status === 404) {
            Logger.warn(err);
            return {
              status: 'NOT_FOUND' as const,
            };
          } else if (isAxiosError(err) && err.response?.status === 403) {
            Logger.warn(err);
            return {
              status: 'SELF_REGISTRATION_NOT_ALLOWED' as const,
            };
          } else {
            Logger.warn(err);
            return {
              status: 'ERROR' as const,
              message: err.message,
            };
          }
        })
    );
  }

  private getAdminApiClient(edfiTenant: EdfiTenant) {
    const client = axios.create({
      baseURL: edfiTenant.sbEnvironment.adminApiUrl,
    });
    client.interceptors.response.use(
      (value) => {
        if (_.isEqual(value.data, failureBut200Response)) {
          // This is nonsensical but needed because of an Admin API bug
          throw new CustomHttpException(
            {
              title: 'Admin API failure',
              type: 'Error',
            },
            500
          );
        }
        return value.data.result;
      },
      (err: AxiosError) => {
        if (err.status === 401) {
          this.adminApiTokens.del(edfiTenant.id);
        }
        Logger.error(`Unable to create client on ${edfiTenant.sbEnvironment.adminApiUrl}: ${err}`);
        throw err;
      }
    );
    client.interceptors.request.use(async (config) => {
      let token: undefined | string = this.adminApiTokens.get(edfiTenant.id);
      if (token === undefined) {
        const adminLogin = await this.logIntoAdminApi(edfiTenant);

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
      return config;
    });
    return client;
  }

  async getVendors(edfiTenant: EdfiTenant) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toGetVendorDto(
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`v1/vendors`)
        .catch((err) => {
          Logger.error(`Error getting vendors for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async getVendor(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetVendorDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any>(`v1/vendors/${vendorId}`)
        .catch((err) => {
          Logger.error(`Error getting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async putVendor(edfiTenant: EdfiTenant, vendorId: number, vendor: PutVendorDto) {
    vendor.vendorId = vendorId;
    return toGetVendorDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .put<any, any>(`v1/vendors/${vendorId}`, vendor)
        .catch((err) => {
          Logger.error(`Error updating vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async postVendor(edfiTenant: EdfiTenant, vendor: PostVendorDto) {
    return toGetVendorDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .post<any, any>(`v1/vendors`, vendor)
        .catch((err) => {
          Logger.error(`Error creating vendor for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async deleteVendor(edfiTenant: EdfiTenant, vendorId: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.getAdminApiClient(edfiTenant)
      .delete<any, any>(`v1/vendors/${vendorId}`)
      .catch((err) => {
        Logger.error(`Error deleting vendor ${vendorId} for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    return undefined;
  }
  async getVendorApplications(edfiTenant: EdfiTenant, vendorId: number) {
    return toGetApplicationDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`v1/vendors/${vendorId}/applications`)
        .catch((err) => {
          Logger.error(`Error getting vendor applications for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }

  async getApplications(edfiTenant: EdfiTenant) {
    return toGetApplicationDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`v1/applications`)
        .catch((err) => {
          Logger.error(`Error getting applications for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async getApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return toGetApplicationDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any>(`v1/applications/${applicationId}`)
        .catch((err) => {
          Logger.error(
            `Error getting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }
  async putApplication(
    edfiTenant: EdfiTenant,
    applicationId: number,
    application: PutApplicationDto
  ) {
    return toGetApplicationDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .put<any, any>(`v1/applications/${applicationId}`, application)
        .catch((err) => {
          Logger.error(
            `Error updating application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
    );
  }
  async postApplication(edfiTenant: EdfiTenant, application: PostApplicationDto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.getAdminApiClient(edfiTenant)
      .post<any, PostApplicationResponseDto>(`v1/applications`, application)
      .catch((err) => {
        Logger.error(`Error creating application for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
  }
  async deleteApplication(edfiTenant: EdfiTenant, applicationId: number) {
    return (
      this.getAdminApiClient(edfiTenant)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .delete<any, any>(`v1/applications/${applicationId}`)
        .catch((err) => {
          Logger.error(
            `Error deleting application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
          );
          throw err;
        })
        .then(() => undefined)
    );
  }
  async resetApplicationCredentials(edfiTenant: EdfiTenant, applicationId: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.getAdminApiClient(edfiTenant)
      .put<any, any>(`v1/applications/${applicationId}/reset-credential`)
      .catch((err) => {
        Logger.error(
          `Error resetting application credentials for application ${applicationId} for tenant ${edfiTenant.id}: ${err}`
        );
        throw err;
      });
  }

  async getClaimsets(edfiTenant: EdfiTenant) {
    return toGetClaimsetDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .get<any, any[]>(`v1/claimsets`)
        .catch((err) => {
          Logger.error(`Error getting claimsets for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async getClaimset(edfiTenant: EdfiTenant, claimsetId: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value: GetClaimsetDto = await this.getAdminApiClient(edfiTenant)
      .get<any, any>(`v1/claimsets/${claimsetId}`)
      .catch((err) => {
        Logger.error(`Error getting claimset ${claimsetId} for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
    value.resourceClaims.forEach((rc, i) => {
      const authStratKeys = ['defaultAuthStrategiesForCRUD', 'authStrategyOverridesForCRUD'];
      authStratKeys.forEach((askey) => {
        rc[askey].forEach((authStrat, j) => {
          if (authStrat === null || 'authorizationStrategies' in authStrat) {
            // do nothing - this is the structure we want.
          } else if ('authStrategyName' in authStrat) {
            // it's the 1.0.0 format, so turn it into the 1.3.1 format expected by FE
            value.resourceClaims[i][askey][j] = {
              authorizationStrategies: [authStrat],
            };
          }
        });
      });
    });
    return toGetClaimsetDto(value);
  }
  async getClaimsetRaw(edfiTenant: EdfiTenant, claimsetId: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.getAdminApiClient(edfiTenant)
      .get<any, any>(`v1/claimsets/${claimsetId}`)
      .catch((err) => {
        Logger.error(`Error getting claimset ${claimsetId} for tenant ${edfiTenant.id}: ${err}`);
        throw err;
      });
  }
  async putClaimset(edfiTenant: EdfiTenant, claimsetId: number, claimset: PutClaimsetDto) {
    return toGetClaimsetDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .put<any, any>(`v1/claimsets/${claimsetId}`, claimset)
        .catch((err) => {
          Logger.error(`Error updating claimset ${claimsetId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async postClaimset(edfiTenant: EdfiTenant, claimset: PostClaimsetDto) {
    return toGetClaimsetDto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.getAdminApiClient(edfiTenant)
        .post<any, any>(`v1/claimsets`, claimset)
        .catch((err) => {
          Logger.error(`Error creating claimset for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
    );
  }
  async deleteClaimset(edfiTenant: EdfiTenant, claimsetId: number) {
    return (
      this.getAdminApiClient(edfiTenant)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .delete<any, any>(`v1/claimsets/${claimsetId}`)
        .catch((err) => {
          Logger.error(`Error deleting claimset ${claimsetId} for tenant ${edfiTenant.id}: ${err}`);
          throw err;
        })
        .then(() => undefined)
    );
  }
}
