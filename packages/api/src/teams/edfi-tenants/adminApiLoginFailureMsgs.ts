import { AdminApiServiceV1, AdminApiServiceV2 } from './starting-blocks';

export const adminApiLoginStatusMsgs: Record<
  | Awaited<ReturnType<typeof AdminApiServiceV1.prototype.logIntoAdminApi>>['status']
  | Awaited<ReturnType<typeof AdminApiServiceV2.prototype.login>>['status'],
  string
> = {
  SUCCESS: 'Admin API connection successful.',
  GOAWAY: 'HTTP/2 GOAWAY received.',
  INVALID_ADMIN_API_URL: 'Invalid Admin API URL provided.',
  LOGIN_FAILED: 'Unknown login failure.',
  NO_ADMIN_API_KEY: 'No Admin API key provided.',
  NO_ADMIN_API_SECRET: 'No Admin API secret provided.',
  NO_ADMIN_API_URL: 'No Admin API URL provided.',
  NO_CONFIG: 'No config found for this environment.',
  NO_TENANT_CONFIG: 'No config found for this tenant in the environment.',
  TOKEN_URI_NOT_FOUND: 'Received 404 when trying to get token.',
  INVALID_CREDS: 'Invalid Admin API credentials.',
};
export const adminApiSelfRegisterFailureMsgs: Record<
  Exclude<
    Awaited<ReturnType<typeof AdminApiServiceV1.prototype.selfRegisterAdminApi>>['status'],
    'SUCCESS'
  >,
  string
> = {
  ENOTFOUND: 'DNS lookup failed for URL provided.',
  NOT_FOUND: 'URL returned "not found".',
  ERROR: 'Failure in Admin API self-registration.',
  SELF_REGISTRATION_NOT_ALLOWED: 'This environment does not allow self-registration.',
};
