import { Logger } from '@nestjs/common';
import { PostSbEnvironmentDto, OdsApiMeta } from '@edanalytics/models';
import axios from 'axios';
import { ValidationHttpException } from './customExceptions';
import config from 'config';


/**
 * Determines the API version (v1 or v2) from Admin API metadata version string
 */
export const determineVersionFromAdminApiMetadata = (adminApiVersion: string): 'v1' | 'v2' => {
  try {
    // Admin API version format: "1.1", "2.0", etc.
    const majorVersion = parseInt(adminApiVersion.split('.')[0], 10);

    if (majorVersion >= 2) {
      return 'v2';
    } else {
      return 'v1';
    }
  } catch (error) {
    Logger.warn('Failed to parse Admin API version, defaulting to v1:', error);
    return 'v1';
  }
};

/**
 * Determines the API version (v1 or v2) from ODS API metadata
 */
export const determineVersionFromMetadata = (odsApiMeta: OdsApiMeta): 'v1' | 'v2' => {
  try {
    // Extract version from metadata
    const version = odsApiMeta.version;

    if (!version) {
      Logger.warn('No version found in ODS API metadata');
      throw new ValidationHttpException({
        field: 'odsApiDiscoveryUrl',
        message: `ODS API metadata does not contain a valid version.`,
      });
    }

    // Parse the major version number correctly from semantic version string
    const majorVersion = parseInt(version.split('.')[0], 10);

    if (majorVersion >= 7) {
      return 'v2';
    } else {
      return 'v1';
    }
  } catch (error) {
    Logger.warn('Failed to parse ODS API version from metadata:', error);
    throw new ValidationHttpException({
      field: 'odsApiDiscoveryUrl',
      message: `ODS API metadata does not contain a valid version.`,
    });
  }
};

/**
 * Determines the tenant mode (MultiTenant or SingleTenant)
 * Prioritizes Admin API multitenantMode field, falls back to ODS API URL pattern detection
 *
 * @param odsApiMeta ODS API metadata containing version and URL information
 * @param adminApiInfo Optional Admin API info response containing tenancy.multitenantMode
 * @returns 'MultiTenant' or 'SingleTenant'
 */
export const determineTenantModeFromMetadata = (
  odsApiMeta: OdsApiMeta,
  adminApiInfo?: { tenancy?: { multitenantMode?: boolean } }
): 'MultiTenant' | 'SingleTenant' => {
  try {
    // Priority 1: Use Admin API multitenantMode field if available
    if (adminApiInfo?.tenancy?.multitenantMode !== undefined) {
      Logger.log(`Using multitenantMode from Admin API: ${adminApiInfo.tenancy.multitenantMode}`);
      return adminApiInfo.tenancy.multitenantMode ? 'MultiTenant' : 'SingleTenant';
    }

    // Priority 2: Fall back to ODS API URL pattern detection
    const urls = odsApiMeta.urls;

    if (!urls) {
      Logger.warn('No URLs found in ODS API metadata');
      throw new ValidationHttpException({
        field: 'odsApiDiscoveryUrl',
        message: `ODS API metadata does not contain valid URLs.`,
      });
    }

    // Determine tenant mode based on the presence of specific URL segment
    if (urls.dataManagementApi.includes('tenantIdentifier')) {
      Logger.log('Determined MultiTenant mode from ODS API URL pattern');
      return 'MultiTenant';
    } else {
      Logger.log('Determined SingleTenant mode from ODS API URL pattern');
      return 'SingleTenant';
    }
  } catch (error) {
    Logger.warn('Error determining tenant mode from metadata:', error);
    throw new ValidationHttpException({
      field: 'odsApiDiscoveryUrl',
      message: `Unable to determine tenant mode from ODS API metadata.`,
    });
  }
};

/**
 * Fetches ODS API metadata from the discovery URL
 */
export const fetchOdsApiMetadata = async (createSbEnvironmentDto: PostSbEnvironmentDto) => {
  const odsApiDiscoveryUrl = createSbEnvironmentDto.odsApiDiscoveryUrl;
  try {
    const response = await axios.get(odsApiDiscoveryUrl, {
      headers: {
        Accept: 'application/json',
      },
      timeout: config.EDFI_URLS_TIMEOUT_MS, // Timeout from config
    });
    if (response.status !== 200) {
      throw new Error(`Failed to fetch ODS API metadata: ${response.statusText}`);
    }
    // Optionally validate the response contains expected discovery document structure
    const odsApiMetaResponse = response.data;
    return odsApiMetaResponse;
  } catch (error) {
    if (isTimeoutError(error)) {
      Logger.warn(`Timeout error fetching ODS API metadata from ${odsApiDiscoveryUrl}:`, error);
      throw new ValidationHttpException({
        field: 'odsApiDiscoveryUrl',
        message: `Connection to Ed-Fi API Discovery URL timed out. Please ensure the URL is correct and the server is reachable.`,
      });
    }
    else {
      Logger.warn(`Error fetching ODS API metadata from ${odsApiDiscoveryUrl}:`, error);
      throw new ValidationHttpException({
        field: 'odsApiDiscoveryUrl',
        message: `Failed to connect to Ed-Fi API Discovery URL. Please check the URL and ensure it is valid.`,
      });
    }
  }
};

/**
 * Fetches Admin API info from the root endpoint
 * Returns the raw response which includes version and tenancy.multitenantMode
 */
export const fetchAdminApiInfo = async (adminApiUrl: string): Promise<any> => {
  if (!adminApiUrl) {
    throw new ValidationHttpException({
      field: 'adminApiUrl',
      message: 'Management API Discovery URL is required',
    });
  }

  try {
    const response = await axios.get(adminApiUrl, {
      headers: {
        Accept: 'application/json',
      },
      timeout: config.EDFI_URLS_TIMEOUT_MS,
    });
    if (response.status !== 200) {
      throw new Error(`Failed to fetch Admin API info: ${response.statusText}`);
    }
    return response.data;
  } catch (error) {
    if (isTimeoutError(error)) {
      Logger.warn(`Timeout error fetching Admin API info from ${adminApiUrl}:`, error);
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: `Connection to Management API Discovery URL timed out. Please ensure the URL is correct and the server is reachable.`,
      });
    } else {
      Logger.warn(`Error fetching Admin API info from ${adminApiUrl}:`, error);
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: `Failed to connect to Management API Discovery URL. Please check the URL and ensure it is valid.`,
      });
    }
  }
};

/**
 * Validates the Management API Discovery URL.
 * @param adminApiUrl The URL to validate.
 * @param odsApiDiscoveryUrl The ODS API URL for version comparison (optional if odsApiMeta provided).
 * @returns A promise that resolves if the URL is valid, or rejects with a ValidationHttpException if it is not.
 */

export const validateAdminApiUrl = async (
  adminApiUrl: string,
  odsApiDiscoveryUrl: string
): Promise<void> => {
  try {
    // Fetch Admin API info (reuses shared fetch function)
    const metadata = await fetchAdminApiInfo(adminApiUrl);

    // Validate the version
    const adminApiVersion = metadata.version;
    if (!adminApiVersion) {
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: `Management API Discovery URL does not contain a valid version.`,
      });
    }

    // Only perform version validation if we have ODS API information
    let odsMetadata: OdsApiMeta;
    if (odsApiDiscoveryUrl) {
      odsMetadata = await fetchOdsApiMetadata({ odsApiDiscoveryUrl } as PostSbEnvironmentDto);
    } else {
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: `Please provide a valid Ed-Fi API Discovery URL to validate against.`,
      });
    }

    const odsDetectedVersion = determineVersionFromMetadata(odsMetadata);

    // Convert Admin API version to same format as ODS API version for comparison
    const adminDetectedVersion = determineVersionFromAdminApiMetadata(adminApiVersion);

    if (odsDetectedVersion !== adminDetectedVersion) {
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: `Management API version (${adminDetectedVersion}) does not match Ed-Fi API version. Expected APIs to be compatible versions.`,
      });
    }

    // Validate tenant mode compatibility - determine modes from both APIs
    const odsTenantMode = determineTenantModeFromMetadata(odsMetadata, metadata);
    const adminTenantMode = determineTenantModeFromMetadata(odsMetadata, metadata);
    validateTenantModeCompatibility(odsTenantMode, adminTenantMode);
  } catch (error) {
    Logger.warn(`Error validating Management API Discovery URL ${adminApiUrl}:`, error.message);
    // Re-throw ValidationHttpException errors to preserve specific error messages
    if (error instanceof ValidationHttpException) {
      throw error;
    }

    // For unexpected errors, throw a generic validation exception
    throw new ValidationHttpException({
      field: 'adminApiUrl',
      message: `Failed to validate Management API Discovery URL. Please check the URL and ensure it is valid.`,
    });
  }
};

/**
 * Validates that ODS API and Admin API tenant modes are compatible
 * Both must be configured with the same tenant mode (both MultiTenant or both SingleTenant)
 *
 * @param odsApiTenantMode Tenant mode detected from ODS API
 * @param adminApiTenantMode Tenant mode detected from Admin API
 * @throws ValidationHttpException if tenant modes don't match
 */
export const validateTenantModeCompatibility = (
  odsApiTenantMode: 'MultiTenant' | 'SingleTenant',
  adminApiTenantMode: 'MultiTenant' | 'SingleTenant'
): void => {
  if (odsApiTenantMode !== adminApiTenantMode) {
    throw new ValidationHttpException({
      field: 'adminApiUrl',
      message: `Ed-Fi API and Management API URLs must both be configured with the same tenant mode (both MultiTenant or both SingleTenant). Currently: Ed-Fi API = ${odsApiTenantMode}, Management API = ${adminApiTenantMode}.`,
    });
  }
};

const isTimeoutError = (error: any): boolean => {
  return error && (
    error.code === 'ECONNABORTED' ||
    (error.message && error.message.toLowerCase().includes('timeout'))
  );
};

