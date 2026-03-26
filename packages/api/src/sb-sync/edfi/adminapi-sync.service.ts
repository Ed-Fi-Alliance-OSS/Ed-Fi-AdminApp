import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { TenantDto, ISbEnvironmentConfigPrivateV2, ISbEnvironmentConfigPublicV2 } from '@edanalytics/models';
import { AdminApiServiceV1, AdminApiServiceV2 } from '../../teams/edfi-tenants/starting-blocks';
import { transformTenantData } from '../../utils/admin-api-data-adapter-utils';
import { persistSyncTenant } from '../sync-ods';
import axios from 'axios';
import { randomBytes, randomUUID } from 'crypto';

export interface SyncResult {
  status: 'SUCCESS' | 'ERROR' | 'NO_ADMIN_API_CONFIG' | 'INVALID_VERSION';
  message?: string;
  tenantsProcessed?: number;
  error?: Error;
}

@Injectable()
export class AdminApiSyncService {
  private readonly logger = new Logger(AdminApiSyncService.name);

  constructor(
    @Inject(AdminApiServiceV2) private adminApiServiceV2: AdminApiServiceV2,
    @Inject(AdminApiServiceV1) private adminApiServiceV1: AdminApiServiceV1,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
  }

  /**
   * Private helper method to process and persist a single tenant's data
   * Handles transformation and database persistence for both new and existing tenants
   * 
   * @param tenantData - The tenant data from Admin API
   * @param sbEnvironment - The parent SB Environment
   * @returns Promise<void>
   */
  private async processTenantData(tenantData: TenantDto, sbEnvironment: SbEnvironment): Promise<void> {
    this.logger.log(`Processing tenant: ${tenantData.name}`);
    this.logger.log(`Tenant has ${tenantData.odsInstances?.length || 0} ODS instances`);

    // Transform tenant data to EdfiTenant format
    const transformedData = transformTenantData(tenantData, sbEnvironment);

    this.logger.log(`Transformed data has ${transformedData.odss?.length || 0} ODS instances`);
    if (transformedData.odss && transformedData.odss.length > 0) {
      transformedData.odss.forEach((ods, idx) => {
        this.logger.log(
          `  ODS ${idx}: id=${ods.odsInstanceId}, name="${ods.odsInstanceName}", dbName="${ods.odsInstanceName}"`
        );
      });
    }

    // Find or create tenant in database
    // Use transformedData.name (normalized) for consistent lookups
    let edfiTenant = await this.edfiTenantsRepository.findOne({
      where: {
        name: transformedData.name,
        sbEnvironmentId: sbEnvironment.id,
      },
      relations: ['odss', 'odss.edorgs'],
    });

    if (!edfiTenant) {
      this.logger.log(`Creating new tenant: ${tenantData.name}`);
      edfiTenant = await this.edfiTenantsRepository.save({
        name: transformedData.name,
        sbEnvironmentId: sbEnvironment.id,
        created: new Date(),
      });
    } else {
      this.logger.log(`Found existing tenant: ${tenantData.name} (id=${edfiTenant.id})`);
      this.logger.log(`  Existing tenant has ${edfiTenant.odss?.length || 0} ODS instances`);
      if (edfiTenant.odss && edfiTenant.odss.length > 0) {
        edfiTenant.odss.forEach((ods, idx) => {
          this.logger.log(
            `    Existing ODS ${idx}: id=${ods.id}, odsInstanceId=${ods.odsInstanceId}, name="${ods.odsInstanceName}", dbName="${ods.dbName}"`
          );
        });
      }
    }

    // Persist ODS instances and education organizations using existing sync logic
    if (transformedData.odss && transformedData.odss.length > 0) {
      this.logger.log(
        `Syncing ${transformedData.odss.length} ODS instance(s) for tenant: ${tenantData.name}`
      );

      await this.entityManager.transaction(async (em) => {
        // Map to SyncableOds format expected by persistSyncTenant
        const syncableOdss = transformedData.odss.map(ods => ({
          id: ods.odsInstanceId,
          name: ods.odsInstanceName,
          dbName: ods.odsInstanceName || `ods-${ods.odsInstanceId}`,
          edorgs: ods.edorgs?.map(edorg => ({
            educationorganizationid: edorg.educationOrganizationId,
            nameofinstitution: edorg.nameOfInstitution,
            shortnameofinstitution: edorg.shortNameOfInstitution || null,
            discriminator: edorg.discriminator,
            parent: edorg.parentId,
          })) || [],
        }));

        this.logger.log(`Calling persistSyncTenant with ${syncableOdss.length} syncable ODS`);
        syncableOdss.forEach((ods, idx) => {
          this.logger.log(`  SyncableODS ${idx}: id=${ods.id}, name="${ods.name}", dbName="${ods.dbName}"`);
        });

        await persistSyncTenant({ em, edfiTenant, odss: syncableOdss });
      });
    }

    this.logger.log(`Successfully processed tenant: ${tenantData.name}`);
  }

  /**
   * Provisions Admin API credentials for newly discovered tenants during sync
   * For multi-tenant v2 environments, this creates credentials for tenants that don't have them yet
   * 
   * @param sbEnvironment - The SB Environment being synced
   * @param discoveredTenants - Tenants discovered from Admin API
   */
  private async provisionCredentialsForNewTenants(
    sbEnvironment: SbEnvironment,
    discoveredTenants: TenantDto[]
  ): Promise<void> {
    const configPublic = sbEnvironment.configPublic;
    const configPrivate = sbEnvironment.configPrivate;

    if (configPublic?.version !== 'v2' || !configPublic.values) {
      return; // Only applicable to v2 environments
    }

    const v2ConfigPublic = configPublic.values as ISbEnvironmentConfigPublicV2;
    const v2ConfigPrivate = configPrivate as ISbEnvironmentConfigPrivateV2 | null;

    const existingTenants = Object.keys(v2ConfigPublic.tenants || {});
    const discoveredTenantNames = discoveredTenants.map(t => t.name);

    // Find tenants that were discovered but don't have credentials yet
    const newTenants = discoveredTenantNames.filter(name => !existingTenants.includes(name));

    if (newTenants.length === 0) {
      this.logger.log('No new tenants to provision credentials for');
      return;
    }

    this.logger.log(`Provisioning credentials for ${newTenants.length} new tenant(s): ${newTenants.join(', ')}`);

    // Initialize tenant configs if they don't exist
    if (!v2ConfigPublic.tenants) {
      v2ConfigPublic.tenants = {};
    }
    if (!v2ConfigPrivate?.tenants) {
      if (!sbEnvironment.configPrivate) {
        sbEnvironment.configPrivate = { tenants: {} } as ISbEnvironmentConfigPrivateV2;
      } else {
        (sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2).tenants = {};
      }
    }

    // Create credentials for each new tenant
    for (const tenantName of newTenants) {
      try {
        this.logger.log(`Creating credentials for new tenant: ${tenantName}`);
        const { clientId, clientSecret } = await this.createClientCredentials(
          sbEnvironment.adminApiUrl!,
          tenantName,
          true // isMultiTenant
        );

        // Store credentials in config
        v2ConfigPublic.tenants![tenantName] = {
          adminApiKey: clientId,
        };

        const privateConfig = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2;
        if (!privateConfig.tenants) {
          privateConfig.tenants = {};
        }
        privateConfig.tenants[tenantName] = {
          adminApiSecret: clientSecret,
        };

        this.logger.log(`Successfully provisioned credentials for tenant: ${tenantName}`);
      } catch (error) {
        this.logger.error(
          `Failed to provision credentials for tenant ${tenantName}: ${error.message}`,
          error.stack
        );
        // Continue with other tenants even if one fails
      }
    }

    // Save the updated environment config to database
    try {
      await this.sbEnvironmentsRepository.save(sbEnvironment);
      this.logger.log(`Updated environment config with credentials for ${newTenants.length} new tenant(s)`);
    } catch (error) {
      this.logger.error(
        `Failed to save updated environment config: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Creates Admin API client credentials via the /connect/register endpoint
   * Similar to the method in sb-environments-edfi.services.ts but adapted for sync flow
   * 
   * @param adminApiUrl - The Admin API base URL
   * @param tenantName - The tenant name (for multi-tenant mode)
   * @param isMultiTenant - Whether this is a multi-tenant environment
   * @returns Promise with clientId and clientSecret
   */
  private async createClientCredentials(
    adminApiUrl: string,
    tenantName: string,
    isMultiTenant: boolean
  ): Promise<{ clientId: string; clientSecret: string; displayName: string }> {
    const registerUrl = `${adminApiUrl}/connect/register`;
    
    // Generate secure random credentials
    const secretCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const secretBytes = randomBytes(32);
    const clientSecret = Array.from(secretBytes, (byte) => secretCharset[byte % secretCharset.length]).join('');
    const clientId = `client_${randomUUID()}`;
    
    const nameSuffixBytes = randomBytes(4);
    const displayNameSuffix = Array.from(nameSuffixBytes, (byte) =>
      (byte % 36).toString(36)
    ).join('');
    const displayName = `AdminApp-v4-${displayNameSuffix}`;
    
    const formData = new URLSearchParams();
    formData.append('ClientId', clientId);
    formData.append('ClientSecret', clientSecret);
    formData.append('DisplayName', displayName);

    const headers = isMultiTenant
      ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          tenant: tenantName,
        }
      : {
          'Content-Type': 'application/x-www-form-urlencoded',
        };

    try {
      const registerResponse = await axios.post(registerUrl, formData.toString(), {
        headers: headers,
      });

      if (!registerResponse.status || registerResponse.status !== 200) {
        throw new Error(`Registration failed! status: ${registerResponse.status}`);
      }

      return { clientId, displayName, clientSecret };
    } catch (error) {
      this.logger.error(`Failed to register client credentials for tenant ${tenantName}:`, error);

      // Provide helpful error message
      if (error.response?.status === 400 && isMultiTenant) {
        throw new Error(
          `Tenant '${tenantName}' does not exist or is not properly configured in the Admin API`
        );
      }

      throw new Error(`Failed to create credentials: ${error.message}`);
    }
  }

  /**
   * Main entry point for Admin API-based environment synchronization
   * Supports both v1 and v2 Admin API versions
   * 
   * @param sbEnvironment - The SB Environment to sync
   * @returns Promise<SyncResult> - Result containing status and processing details
   */
  async syncEnvironmentData(sbEnvironment: SbEnvironment): Promise<SyncResult> {
    this.logger.log(`Starting Admin API sync for environment: ${sbEnvironment.name}`);

    try {
      // Validate environment has necessary Admin API configuration
      if (!sbEnvironment.adminApiUrl) {
        this.logger.error(`Environment ${sbEnvironment.name} does not have Admin API URL configured`);
        return {
          status: 'NO_ADMIN_API_CONFIG',
          message: 'Admin API URL is not configured for this environment',
        };
      }

      // Determine API version (v1 or v2) and select appropriate service
      const version = sbEnvironment.version;
      if (!version || (version !== 'v1' && version !== 'v2')) {
        this.logger.error(`Environment ${sbEnvironment.name} has invalid or missing version: ${version}`);
        return {
          status: 'INVALID_VERSION',
          message: `Invalid API version: ${version}. Expected 'v1' or 'v2'`,
        };
      }

      this.logger.log(`Environment ${sbEnvironment.name} is using Admin API version: ${version}`);

      // Select appropriate Admin API service based on version
      const adminApiService = version === 'v1' ? this.adminApiServiceV1 : this.adminApiServiceV2;

      // Discover and sync tenants based on multi-tenant configuration
      this.logger.log(`Discovering tenants for environment: ${sbEnvironment.name}`);
      const tenants: TenantDto[] = await adminApiService.getTenants(sbEnvironment);

      if (!tenants || tenants.length === 0) {
        this.logger.warn(`No tenants found for environment: ${sbEnvironment.name}`);
        return {
          status: 'SUCCESS',
          message: 'No tenants found to sync',
          tenantsProcessed: 0,
        };
      }

      this.logger.log(`Found ${tenants.length} tenant(s) for environment: ${sbEnvironment.name}`);

      // For v2 multi-tenant environments, provision credentials for newly discovered tenants
      if (version === 'v2') {
        const configPublic = sbEnvironment.configPublic;
        const isMultiTenant = 
          configPublic?.version === 'v2' &&
          configPublic.values?.meta?.mode === 'MultiTenant';

        if (isMultiTenant) {
          await this.provisionCredentialsForNewTenants(sbEnvironment, tenants);
          
          // Reload environment with updated config
          const reloadedEnvironment = await this.sbEnvironmentsRepository.findOne({
            where: { id: sbEnvironment.id },
          });
          if (reloadedEnvironment) {
            sbEnvironment = reloadedEnvironment;
          }
        }
      }

      // Process tenant data using existing table structures
      let processedCount = 0;
      for (const tenantData of tenants) {
        try {
          await this.processTenantData(tenantData, sbEnvironment);
          processedCount++;
        } catch (tenantError) {
          this.logger.error(
            `Error processing tenant ${tenantData.name}: ${tenantError.message}`,
            tenantError.stack
          );
          // Continue processing other tenants
        }
      }

      this.logger.log(
        `Admin API sync completed for environment: ${sbEnvironment.name}. Processed ${processedCount}/${tenants.length} tenant(s)`
      );

      return {
        status: 'SUCCESS',
        message: `Successfully synced ${processedCount} of ${tenants.length} tenant(s)`,
        tenantsProcessed: processedCount,
      };
    } catch (error) {
      // Extract detailed error information
      let errorMessage = 'Unknown error occurred';
      let errorDetails = '';

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if it's a CustomHttpException with additional details
        if ('response' in error && typeof error.response === 'object' && error.response !== null) {
          const response = error.response as any;
          if (response.message) {
            errorDetails = Array.isArray(response.message) 
              ? response.message.join(', ') 
              : response.message;
          }
          if (response.title) {
            errorMessage = response.title;
          }
        }
      }

      const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      this.logger.error(
        `Failed to sync environment ${sbEnvironment.name}: ${fullMessage}`,
        error instanceof Error ? error.stack : String(error)
      );
      
      return {
        status: 'ERROR',
        message: fullMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Syncs tenant-specific data including ODS instances and education organizations
   * Only supports v2 Admin API (multi-tenant mode)
   * For v1 environments, use syncEnvironmentData instead
   * 
   * @param edfiTenant - The EdFi tenant to sync
   * @returns Promise<SyncResult> - Result containing status and processing details
   */
  async syncTenantData(edfiTenant: EdfiTenant): Promise<SyncResult> {
    this.logger.log(`Starting tenant sync for: ${edfiTenant.name}`);

    try {
      // Load the tenant with its parent environment
      const tenantWithEnvironment = await this.edfiTenantsRepository.findOne({
        where: { id: edfiTenant.id },
        relations: ['sbEnvironment'],
      });

      if (!tenantWithEnvironment || !tenantWithEnvironment.sbEnvironment) {
        this.logger.error(`Tenant ${edfiTenant.name} not found or missing environment`);
        return {
          status: 'ERROR',
          message: 'Tenant not found or missing environment',
        };
      }

      const sbEnvironment = tenantWithEnvironment.sbEnvironment;

      // Validate environment has necessary Admin API configuration
      if (!sbEnvironment.adminApiUrl) {
        this.logger.error(`Environment for tenant ${edfiTenant.name} does not have Admin API URL configured`);
        return {
          status: 'NO_ADMIN_API_CONFIG',
          message: 'Admin API URL is not configured for this tenant\'s environment',
        };
      }

      // Determine API version (v1 or v2) and select appropriate service
      const version = sbEnvironment.version;
      if (!version || (version !== 'v1' && version !== 'v2')) {
        this.logger.error(`Environment for tenant ${edfiTenant.name} has invalid version: ${version}`);
        return {
          status: 'INVALID_VERSION',
          message: `Invalid API version: ${version}. Expected 'v1' or 'v2'`,
        };
      }

      // V1 is single-tenant, so individual tenant sync is not supported
      if (version === 'v1') {
        this.logger.warn(`Tenant sync not supported for v1 environments. Use environment-level sync instead.`);
        return {
          status: 'ERROR',
          message: 'V1 Admin API is single-tenant. Use syncEnvironmentData to sync all data.',
        };
      }

      this.logger.log(`Syncing tenant ${edfiTenant.name} using Admin API v2`);

      // Validate that credentials exist for this tenant in the environment configuration
      const configPublic = sbEnvironment.configPublic;
      const configPrivate = sbEnvironment.configPrivate;
      const v2Config =
        'version' in configPublic && configPublic.version === 'v2' ? configPublic.values : undefined;
      const v2ConfigPrivate =
        'version' in configPublic && configPublic.version === 'v2'
          ? (configPrivate as ISbEnvironmentConfigPrivateV2)
          : undefined;

      if (!v2Config || !v2ConfigPrivate) {
        this.logger.error(`Environment configuration is not v2 format for tenant ${edfiTenant.name}`);
        return {
          status: 'ERROR',
          message: 'Environment is not configured for Admin API v2',
        };
      }

      // Check if credentials exist for this specific tenant
      const tenantConfigPublic = v2Config?.tenants?.[edfiTenant.name];
      const tenantConfigPrivate = v2ConfigPrivate?.tenants?.[edfiTenant.name];

      if (!tenantConfigPublic || !tenantConfigPrivate) {
        const availableTenants = Object.keys(v2Config?.tenants || {});
        this.logger.error(
          `No credentials found for tenant "${edfiTenant.name}" in environment "${sbEnvironment.name}". ` +
          `Available tenants with credentials: [${availableTenants.join(', ')}]`
        );
        return {
          status: 'ERROR',
          message: `Tenant "${edfiTenant.name}" does not have credentials configured in this environment.\n\n` +
            `Available tenants: ${availableTenants.length > 0 ? availableTenants.join(', ') : '(none)'}\n\n` +
            `This usually means:\n` +
            `1. The tenant was discovered from the Admin API but you don't have credentials for it\n` +
            `2. The tenant name doesn't exactly match the credentials key (check spelling/case)\n` +
            `3. The tenant was deleted from the Admin API but still exists in the database\n\n` +
            `To fix this:\n` +
            `- Add credentials for "${edfiTenant.name}" to your environment configuration\n` +
            `- Or run environment-level sync to clean up orphaned tenants\n` +
            `- Or delete this tenant from the database if it no longer exists in the Admin API`,
        };
      }

      if (!tenantConfigPublic.adminApiKey || !tenantConfigPrivate.adminApiSecret) {
        this.logger.error(`Incomplete credentials for tenant ${edfiTenant.name}`);
        return {
          status: 'ERROR',
          message: `Tenant "${edfiTenant.name}" is missing adminApiKey or adminApiSecret in the environment configuration.`,
        };
      }

      this.logger.log(`Credentials validated for tenant ${edfiTenant.name}`);

      // For v2, fetch tenant details from the correct endpoint
      const endpoint = `tenants/${edfiTenant.name}/OdsInstances/edOrgs`;
      
      this.logger.log(`Fetching tenant details from Admin API: ${endpoint}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tenantDetails: any;
      try {
        // Use getAdminApiClient with tenantWithEnvironment to ensure tenant-specific authentication
        tenantDetails = await this.adminApiServiceV2.getAdminApiClient(tenantWithEnvironment)
          .get(endpoint);
      } catch (apiError) {
        this.logger.error(
          `Failed to retrieve tenant details from Admin API: ${apiError.message}`,
          apiError.stack
        );
        return {
          status: 'ERROR',
          message: `Admin API call failed: ${apiError.message}`,
          error: apiError,
        };
      }

      if (!tenantDetails) {
        this.logger.warn(`No details returned for tenant: ${edfiTenant.name}`);
        return {
          status: 'SUCCESS',
          message: 'No tenant details found',
        };
      }

      this.logger.log(
        `Retrieved ${tenantDetails.odsInstances?.length || 0} ODS instance(s) for tenant: ${edfiTenant.name}`
      );

      // Transform the v2 response to TenantDto format
      const tenantDto: TenantDto = {
        id: tenantDetails.id || edfiTenant.name,
        name: tenantDetails.name || edfiTenant.name,
        odsInstances: (tenantDetails.odsInstances || []).map((instance: any) => ({
          id: instance.id ?? null,
          name: instance.name || 'Unknown ODS Instance',
          instanceType: instance.instanceType,
          edOrgs: (instance.educationOrganizations || []).map((edOrg: any) => ({
            instanceId: instance.id,
            instanceName: instance.name,
            educationOrganizationId: edOrg.educationOrganizationId,
            nameOfInstitution: edOrg.nameOfInstitution,
            shortNameOfInstitution: edOrg.shortNameOfInstitution,
            discriminator: edOrg.discriminator,
            parentId: edOrg.parentId,
          })),
        })),
      };

      // Use the shared helper to process the tenant data
      await this.processTenantData(tenantDto, sbEnvironment);

      this.logger.log(`Successfully synced tenant: ${edfiTenant.name}`);

      return {
        status: 'SUCCESS',
        message: `Successfully synced ${tenantDto.odsInstances?.length || 0} ODS instance(s)`,
      };
    } catch (error) {
      // Extract detailed error information
      let errorMessage = 'Unknown error occurred';
      let errorDetails = '';

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if it's a CustomHttpException or HttpException with additional details
        if ('response' in error && typeof error.response === 'object' && error.response !== null) {
          const response = error.response as any;
          
          // Extract message details
          if (response.message) {
            if (typeof response.message === 'string') {
              errorDetails = response.message;
            } else if (Array.isArray(response.message)) {
              errorDetails = response.message.join(', ');
            } else if (typeof response.message === 'object') {
              errorDetails = JSON.stringify(response.message);
            }
          }
          
          // Use title as the primary error message if available
          if (response.title && typeof response.title === 'string') {
            errorMessage = response.title;
          }
          
          // Include type information if available
          if (response.type && typeof response.type === 'string') {
            errorMessage = `[${response.type}] ${errorMessage}`;
          }
        }
      }

      const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      this.logger.error(
        `Failed to sync tenant ${edfiTenant.name}: ${fullMessage}`,
        error instanceof Error ? error.stack : String(error)
      );
      
      return {
        status: 'ERROR',
        message: fullMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}