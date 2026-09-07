import { Logger } from '@nestjs/common';
import axios from 'axios';
import config from 'config';

/**
 * The `urls` block on Admin API's Information response (`GET /`).
 * `tenancy` is an empty string for V1, which has no tenancy endpoint.
 */
export interface AdminApiUrls {
  openApiMetadata?: string;
  tenancy?: string;
}

export interface AdminApiInfoWithUrls {
  specificationVersion?: string;
  urls?: AdminApiUrls;
}

/**
 * MISCONFIGURED: Admin API answered 503 with a parsable body — `MultiTenancy`
 * is on with no tenants configured. Its message names the appsettings fix and
 * is safe to show the operator verbatim.
 *
 * UNAVAILABLE: the tenant list could not be determined for any other reason.
 * Blocks identically, but the response text is logged rather than displayed.
 */
export type TenancyFailureKind = 'MISCONFIGURED' | 'UNAVAILABLE';

export class AdminApiTenancyError extends Error {
  readonly kind: TenancyFailureKind;
  /** Admin API's own message. Only ever populated for MISCONFIGURED. */
  readonly detail?: string;

  constructor(kind: TenancyFailureKind, message: string, detail?: string) {
    super(message);
    this.name = 'AdminApiTenancyError';
    this.kind = kind;
    this.detail = detail;
  }
}

export type TenancyResult =
  | { supported: false }
  | { supported: true; tenants: string[]; mode: 'MultiTenant' | 'SingleTenant' };

interface TenancyEndpointResponse {
  tenants?: string[];
}

/**
 * Reads Admin API's 503 body, which differs by specification version:
 * V3 returns problem details (`detail`), V2 returns `{ message }`.
 * Returns undefined when the body is not a parsable JSON object — a bare 503
 * from a reverse proxy or a stopped container, which is not the
 * misconfiguration case.
 */
const parseErrorDetail = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { detail, message } = data as { detail?: unknown; message?: unknown };
  if (typeof detail === 'string' && detail.length > 0) {
    return detail;
  }
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  return undefined;
};

/**
 * Fetches the tenant list from Admin API's tenancy endpoint.
 *
 * The endpoint address comes from `urls.tenancy` on the Information response
 * rather than being constructed from the specification version, so host and
 * prefix differences the client cannot infer are handled by Admin API itself.
 *
 * Tenant mode is derived from the array: non-empty means MultiTenant, empty
 * means SingleTenant. That derivation is only safe because Admin API answers
 * 503 when `MultiTenancy` is on with no tenants configured, so an empty array
 * from a *successful* call cannot mean "misconfigured".
 *
 * No error is ever reported as single-tenant — a failure throws.
 */
export const fetchAdminApiTenancy = async (
  adminApiInfo: AdminApiInfoWithUrls
): Promise<TenancyResult> => {
  const tenancyUrl = adminApiInfo?.urls?.tenancy;

  if (!tenancyUrl) {
    Logger.log('Admin API does not advertise a tenancy endpoint; tenancy lookup skipped');
    return { supported: false };
  }

  let data: TenancyEndpointResponse;
  try {
    const response = await axios.get<TenancyEndpointResponse>(tenancyUrl, {
      headers: { Accept: 'application/json' },
      timeout: config.EDFI_URLS_TIMEOUT_MS,
    });
    data = response.data;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const body = (error as { response?: { data?: unknown } })?.response?.data;

    if (status === 404) {
      Logger.log(`Tenancy endpoint ${tenancyUrl} returned 404; tenancy lookup skipped`);
      return { supported: false };
    }

    const detail = status === 503 ? parseErrorDetail(body) : undefined;
    if (detail) {
      Logger.warn(`Admin API reported a tenancy misconfiguration: ${detail}`);
      throw new AdminApiTenancyError('MISCONFIGURED', detail, detail);
    }

    Logger.warn(
      `Failed to read tenancy from ${tenancyUrl} (status ${status ?? 'none'}): ${JSON.stringify(body ?? (error as Error)?.message)}`
    );
    throw new AdminApiTenancyError(
      'UNAVAILABLE',
      'Could not determine tenancy for this Management API.'
    );
  }

  const tenants = Array.isArray(data?.tenants) ? data.tenants : [];
  const mode = tenants.length > 0 ? 'MultiTenant' : 'SingleTenant';
  Logger.log(`Admin API tenancy: ${mode} (${tenants.length} tenant(s))`);
  return { supported: true, tenants, mode };
};
