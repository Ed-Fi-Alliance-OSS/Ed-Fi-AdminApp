import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { EdfiTenant, SbEnvironment } from "@edanalytics/models-server";
import { TenantDto } from "@edanalytics/models";
import { AdminApiServiceV1, AdminApiServiceV2 } from "../../teams/edfi-tenants/starting-blocks";
import { transformTenantData } from "../../utils/admin-api-data-adapter-utils";
import { persistSyncTenant } from "../sync-ods";

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
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
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

      // Process tenant data using existing table structures
      let processedCount = 0;
      for (const tenantData of tenants) {
        try {
          this.logger.log(`Processing tenant: ${tenantData.name}`);

          // Transform tenant data to EdfiTenant format
          const transformedData = transformTenantData(tenantData, sbEnvironment);

          // Find or create tenant in database
          let edfiTenant = await this.edfiTenantsRepository.findOne({
            where: {
              name: tenantData.name,
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

              await persistSyncTenant({ em, edfiTenant, odss: syncableOdss });
            });
          }

          processedCount++;
          this.logger.log(`Successfully processed tenant: ${tenantData.name}`);
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
      this.logger.error(
        `Failed to sync environment ${sbEnvironment.name}: ${error.message}`,
        error.stack
      );
      return {
        status: 'ERROR',
        message: error.message,
        error,
      };
    }
  }

  /**
   * Syncs tenant-specific data including ODS instances and education organizations
   * Private method for internal tenant processing
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

      this.logger.log(`Syncing tenant ${edfiTenant.name} using Admin API version: ${version}`);

      // Select appropriate Admin API service based on version
      const adminApiService = version === 'v1' ? this.adminApiServiceV1 : this.adminApiServiceV2;

      // Retrieve ODS instances with education organizations for the tenant
      const endpoint = version === 'v1' 
        ? `v1/tenant/${edfiTenant.name}/details`
        : `tenant/${edfiTenant.name}/details`;

      this.logger.log(`Fetching tenant details from Admin API: ${endpoint}`);

      // Use the getAdminApiClient method to make the API call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tenantDetails: any;
      try {
        if (version === 'v1') {
          // For v1, we need to use the environment-level client
          tenantDetails = await (adminApiService as AdminApiServiceV1)['getAdminApiClientUsingEnv'](sbEnvironment)
            .get(endpoint);
        } else {
          // For v2, we need the tenant-level client
          tenantDetails = await (adminApiService as AdminApiServiceV2)['getAdminApiClient'](tenantWithEnvironment)
            .get(endpoint);
        }
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

      // Transform and store data in existing structures
      const odsInstances = tenantDetails.odsInstances || [];

      if (odsInstances.length === 0) {
        this.logger.log(`No ODS instances to sync for tenant: ${edfiTenant.name}`);
        return {
          status: 'SUCCESS',
          message: 'No ODS instances to sync',
        };
      }

      // Map to SyncableOds format for persistence
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncableOdss = odsInstances.map((instance: any) => ({
        id: instance.odsInstanceId ?? instance.id ?? null,
        name: instance.name ?? `ODS Instance`,
        dbName: instance.name ?? `ods-${instance.odsInstanceId ?? instance.id}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edorgs: (instance.edOrgs || []).map((edorg: any) => ({
          educationorganizationid: edorg.educationOrganizationId,
          nameofinstitution: edorg.nameOfInstitution,
          shortnameofinstitution: edorg.shortNameOfInstitution || null,
          discriminator: edorg.discriminator,
          parent: edorg.parentId,
        })),
      }));

      this.logger.log(
        `Persisting ${syncableOdss.length} ODS instance(s) with education organizations for tenant: ${edfiTenant.name}`
      );

      // Persist using transaction
      await this.entityManager.transaction(async (em) => {
        await persistSyncTenant({ em, edfiTenant, odss: syncableOdss });
      });

      this.logger.log(`Successfully synced tenant: ${edfiTenant.name}`);

      return {
        status: 'SUCCESS',
        message: `Successfully synced ${syncableOdss.length} ODS instance(s)`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync tenant ${edfiTenant.name}: ${error.message}`,
        error.stack
      );
      return {
        status: 'ERROR',
        message: error.message,
        error,
      };
    }
  }
}