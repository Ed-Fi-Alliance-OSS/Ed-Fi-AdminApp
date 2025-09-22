import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import {
  determineTenantModeFromMetadata,
  determineVersionFromMetadata,
  fetchOdsApiMetadata,
  validateAdminApiUrl,
  ValidationHttpException,
} from '../utils';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { addUserCreating, EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { EntityManager, Repository } from 'typeorm';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import {
  PostSbEnvironmentDto,
  SbV1MetaOds,
  EdorgType,
  SbV2MetaEnv,
  SbV2MetaOds,
  PostSbEnvironmentTenantDTO,
  GetUserDto,
} from '@edanalytics/models';
import axios from 'axios';
import { persistSyncTenant, SyncableOds } from '../sb-sync/sync-ods';
import { randomUUID } from 'crypto';

type TenantCredentials = { clientId: string; clientSecret: string; displayName: string };
type TenantCredentialsMap = Map<string, TenantCredentials>;

@Injectable()
export class SbEnvironmentsEdFiService {
  private readonly logger = new Logger(SbEnvironmentsEdFiService.name);

  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  private errorMessageEnhancer(originalMessage: string): string {
    // Define error patterns and their enhanced messages
    const errorPatterns = [
      // HTTP status codes
      { pattern: '404', message: 'Service not found (404)' },
      { pattern: '401', message: 'Unauthorized (401) - check API credentials' },
      { pattern: '403', message: 'Forbidden (403) - insufficient permissions' },
      { pattern: '400', message: 'Bad request (400) - invalid request format' },
      { pattern: '500', message: 'Internal server error (500) - service may be down' },
      { pattern: '502', message: 'Bad gateway (502) - service may be unreachable' },
      { pattern: '503', message: 'Service unavailable (503) - service may be temporarily down' },
      // Network error codes
      { pattern: 'ECONNREFUSED', message: 'Connection refused - service may not be running' },
      { pattern: 'ENOTFOUND', message: 'Host not found - check the URL' },
      { pattern: 'certificate', message: 'SSL certificate error - check certificate configuration' },
      { pattern: 'ECONNRESET', message: 'Connection reset - service may have closed the connection' },
      { pattern: 'timeout', message: 'Request timeout - service may be slow to respond' },
    ];

    // Find the first matching pattern
    const matchedPattern = errorPatterns.find(({ pattern }) =>
      originalMessage.includes(pattern)
    );

    // Return enhanced message or original if no pattern matches
    return matchedPattern ? matchedPattern.message : originalMessage;
  }

  private handleOperationError(error: unknown, detectedVersion: string): never {

    if (error instanceof ValidationHttpException) {
      // Extract the current field and message from the ValidationHttpException
      const response = error.getResponse() as {
        field?: string;
        message?: string;
        data?: {
          errors?: Record<string, { message?: string; type?: string }>;
        }
      };
      let originalField = 'general';
      let originalMessage = 'Validation error occurred';

      // First try to get field and message from the top level
      if (response?.field) {
        originalField = response.field;
      }
      if (response?.message) {
        originalMessage = response.message;
      }

      // If not found, check the nested data.errors structure
      if (response?.data?.errors) {
        const firstErrorKey = Object.keys(response.data.errors)[0];
        if (firstErrorKey) {
          originalField = firstErrorKey; // Use the field name from errors object
          const errorDetails = response.data.errors[firstErrorKey];
          if (errorDetails?.message) {
            originalMessage = errorDetails.message;
          }
        }
      }

      // Use the common error message enhancer
      const enhancedMessage = this.errorMessageEnhancer(originalMessage);

      // Re-throw with enhanced message but preserve the original field
      throw new ValidationHttpException({
        field: originalField,
        message: enhancedMessage,
      });
    }

    let message: string;

    if (error instanceof Error) {
      // Use the common error message enhancer
      message = this.errorMessageEnhancer(error.message);
    } else {
      message = 'Unknown error occurred';
    }

    // Enhanced error logging
    this.logger.error('Create environment error details:', {
      error: message,
      code: (error as NodeJS.ErrnoException)?.code, // Node.js specific error codes
      cause: (error as { cause?: unknown })?.cause,
    });

    // Create new InternalServerErrorException
    throw new InternalServerErrorException(
      `Error while creating the ${detectedVersion} environment`
    );
  }

  async create(createSbEnvironmentDto: PostSbEnvironmentDto, user: GetUserDto | undefined) {
    // First validate the Admin API URL before proceeding with any operations
    if (createSbEnvironmentDto.adminApiUrl) {
      await validateAdminApiUrl(createSbEnvironmentDto.adminApiUrl);
    }

    // Validate ODS Discovery URL if provided
    if (createSbEnvironmentDto.odsApiDiscoveryUrl) {
      try {
        // Declare variables in the outer scope so they can be used later
        let odsApiMetaResponse;
        let detectedVersion;
        let tenantMode;

        // Nested try-catch for ODS API metadata operations
        try {
          // Fetch ODS API metadata
          odsApiMetaResponse = await fetchOdsApiMetadata(createSbEnvironmentDto);

          // Auto-detect version from metadata
          detectedVersion = determineVersionFromMetadata(odsApiMetaResponse);

          // Override the version with detected version
          createSbEnvironmentDto.version = detectedVersion;

          // Determine tenant mode
          tenantMode = determineTenantModeFromMetadata(odsApiMetaResponse);
          createSbEnvironmentDto.isMultitenant = tenantMode === 'MultiTenant';

        } catch (metadataError) {
          // Handle ODS Discovery URL specific errors
          this.logger.error('ODS metadata fetch error:', metadataError);

          throw new ValidationHttpException({
            field: 'odsApiDiscoveryUrl',
            message: metadataError.message,
          });
        }

        // Validate tenants and create credentials for multi-tenant v2 environments
        let tenantCredentialsMap: TenantCredentialsMap | undefined;
        if (createSbEnvironmentDto.isMultitenant && createSbEnvironmentDto.version === 'v2') {
          tenantCredentialsMap = await this.validateTenantsAndCreateCredentials(createSbEnvironmentDto);
        }

        // Replace the current configPublic logic with this:
        const configPublic =
          createSbEnvironmentDto.version === 'v1'
            ? {
                startingBlocks: createSbEnvironmentDto.startingBlocks,
                odsApiMeta: odsApiMetaResponse,
                adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                version: createSbEnvironmentDto.version,
                values: {
                  edfiHostname: createSbEnvironmentDto.odsApiDiscoveryUrl,
                  adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                },
              }
            : {
                startingBlocks: createSbEnvironmentDto.startingBlocks,
                odsApiMeta: odsApiMetaResponse,
                adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                version: createSbEnvironmentDto.version,
                values: {
                  meta: {
                    envlabel: createSbEnvironmentDto.environmentLabel,
                    mode: tenantMode,
                    domainName: createSbEnvironmentDto.odsApiDiscoveryUrl,
                    adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                    tenantManagementFunctionArn: '',
                    tenantResourceTreeFunctionArn: '',
                    odsManagementFunctionArn: '',
                    edorgManagementFunctionArn: '',
                    dataFreshnessFunctionArn: '',
                  } satisfies SbV2MetaEnv,
                  adminApiUuid: randomUUID(),
                },
              };
        Logger.log(
          `Auto-detected API version: ${detectedVersion} from ODS version: ${odsApiMetaResponse.version}`
        );
        const sbEnvironment = await this.sbEnvironmentsRepository.save(
          addUserCreating(
            this.sbEnvironmentsRepository.create({
              name: createSbEnvironmentDto.name,
              envLabel: createSbEnvironmentDto.environmentLabel, //this field is for the lambda function
              configPublic: configPublic,
            } as SbEnvironment),
            user
          )
        );
        if (createSbEnvironmentDto.version === 'v1') {
          await this.syncv1Environment(sbEnvironment, createSbEnvironmentDto);
        } else if (createSbEnvironmentDto.version === 'v2') {
          // For v2, we need to investigate if applies the same process
          await this.syncv2Environment(sbEnvironment, createSbEnvironmentDto, tenantCredentialsMap);
        }

        return sbEnvironment;
      } catch (error) {
        this.handleOperationError(error, createSbEnvironmentDto.version);
      }
    }
  }

  private async syncv1Environment(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto: PostSbEnvironmentDto
  ) {
    // For v1, use the first tenant from the frontend data
    if (!createSbEnvironmentDto.tenants || createSbEnvironmentDto.tenants.length === 0) {
      throw new ValidationHttpException({
        field: 'tenants',
        message: 'At least one tenant is required for v1 deployment',
      });
    }

    const defaultTenantDto = createSbEnvironmentDto.tenants[0];

    // Find or create the default tenant
    const edfiTenant = await this.findOrCreateTenant(sbEnvironment, defaultTenantDto.name);

    // Sync the tenant data using V1 method
    await this.syncTenantDataV1(defaultTenantDto, edfiTenant);

    // Make a POST request to register the client
    const { clientId, clientSecret } = await this.createClientCredentials(createSbEnvironmentDto);

    // Save the admin API credentials
    const credentials = {
      ClientId: clientId,
      ClientSecret: clientSecret,
      url: createSbEnvironmentDto.adminApiUrl,
    };
    await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, credentials);

    return { status: 'SUCCESS' as const };
  }

  private async syncv2Environment(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenantCredentialsMap?: TenantCredentialsMap
  ) {
    if (createSbEnvironmentDto.isMultitenant) {
      return await this.syncMultiTenantEnvironment(sbEnvironment, createSbEnvironmentDto, tenantCredentialsMap);
    } else {
      return await this.syncSingleTenantEnvironment(sbEnvironment, createSbEnvironmentDto);
    }
  }

  private async syncMultiTenantEnvironment(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenantCredentialsMap?: TenantCredentialsMap
  ) {
    if (!createSbEnvironmentDto.tenants || createSbEnvironmentDto.tenants.length === 0) {
      throw new ValidationHttpException({
        field: 'tenants',
        message: 'At least one tenant is required for multi-tenant deployment',
      });
    }

    for (const tenant of createSbEnvironmentDto.tenants) {
      await this.createAndSyncTenant(sbEnvironment, createSbEnvironmentDto, tenant, tenantCredentialsMap);
    }

    return { status: 'SUCCESS' as const };
  }

  private async syncSingleTenantEnvironment(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto: PostSbEnvironmentDto
  ) {
    // For single-tenant, use the first tenant from the frontend data
    if (!createSbEnvironmentDto.tenants || createSbEnvironmentDto.tenants.length === 0) {
      throw new ValidationHttpException({
        field: 'tenants',
        message: 'At least one tenant is required for single-tenant deployment',
      });
    }

    const defaultTenantDto = createSbEnvironmentDto.tenants[0];

    // Find or create the default tenant
    const edfiTenant = await this.findOrCreateTenant(sbEnvironment, defaultTenantDto.name);

    // Sync the tenant data
    await this.syncTenantData(sbEnvironment, createSbEnvironmentDto, defaultTenantDto, edfiTenant);

    return { status: 'SUCCESS' as const };
  }

  private async createAndSyncTenant(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenantDto: PostSbEnvironmentTenantDTO,
    tenantCredentialsMap?: TenantCredentialsMap
  ) {
    // Create the tenant in the local database
    const tenantEntity = await this.edfiTenantsRepository.save({
      name: tenantDto.name,
      sbEnvironmentId: sbEnvironment.id,
    });

    await this.syncTenantData(sbEnvironment, createSbEnvironmentDto, tenantDto, tenantEntity, tenantCredentialsMap);
  }

  private async findOrCreateTenant(
    sbEnvironment: SbEnvironment,
    tenantName: string
  ): Promise<EdfiTenant> {
    const existingTenants = await this.edfiTenantsRepository.find({
      where: { sbEnvironmentId: sbEnvironment.id },
    });

    if (existingTenants.length === 0) {
      return await this.edfiTenantsRepository.save({
        name: tenantName,
        sbEnvironmentId: sbEnvironment.id,
      });
    }

    return existingTenants[0];
  }

  private async syncTenantData(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenantDto: PostSbEnvironmentTenantDTO,
    tenantEntity: EdfiTenant,
    tenantCredentialsMap?: TenantCredentialsMap
  ) {
    // Create ODS metadata objects
    const metaOds: SbV2MetaOds[] = this.createODSObject(tenantDto);

    // Sync ODS and EdOrgs
    await this.saveSyncableOds(metaOds, tenantEntity);

    // Create Admin API credentials - use cached credentials if available
    await this.createAdminAPICredentialsV2(createSbEnvironmentDto, tenantEntity, sbEnvironment, tenantCredentialsMap);
  }

  private async syncTenantDataV1(tenantDto: PostSbEnvironmentTenantDTO, tenantEntity: EdfiTenant) {
    // Create V1 ODS metadata objects
    const metaOds: SbV1MetaOds[] = this.createODSObjectV1(tenantDto);

    // Sync ODS and EdOrgs using V1 method
    await this.saveSyncableOdsV1(metaOds, tenantEntity);
  }

  private async createAdminAPICredentialsV2(
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenantEntity: { name: string; sbEnvironmentId: number } & EdfiTenant,
    sbEnvironment: SbEnvironment,
    tenantCredentialsMap?: TenantCredentialsMap
  ) {
    let clientId: string;
    let clientSecret: string;

    // Use cached credentials if available, otherwise create new ones
    if (tenantCredentialsMap && tenantCredentialsMap.has(tenantEntity.name)) {
      const cachedCredentials = tenantCredentialsMap.get(tenantEntity.name);
      clientId = cachedCredentials.clientId;
      clientSecret = cachedCredentials.clientSecret;
      this.logger.log(`Using cached credentials for tenant: ${tenantEntity.name}`);
    } else {
      // Fallback to creating new credentials (for single-tenant or when cache is not available)
      const credentials = await this.createClientCredentials(
        createSbEnvironmentDto,
        tenantEntity.name
      );
      clientId = credentials.clientId;
      clientSecret = credentials.clientSecret;
    }

    await this.startingBlocksServiceV2.saveAdminApiCredentials(tenantEntity, sbEnvironment, {
      ClientId: clientId,
      ClientSecret: clientSecret,
      url: createSbEnvironmentDto.adminApiUrl,
    });
  }

  private createODSObject(tenant: PostSbEnvironmentTenantDTO): SbV2MetaOds[] {
    return (
      tenant.odss?.map((ods) => ({
        id: ods.id, // the ID of the ODS instance, it has to be get it from adminapi/db
        name: ods.name, // The ODS name
        dbname: ods.dbName,
        edorgs: ods.allowedEdOrgs
          ?.split(',')
          .map((id) => id.trim())
          .filter((edorg) => edorg !== '' && !isNaN(Number(edorg)))
          .map((edorg) => ({
            educationorganizationid: parseInt(edorg),
            nameofinstitution: `Institution #${edorg}`,
            shortnameofinstitution: `I#${edorg}`,
            id: edorg,
            discriminator: EdorgType['edfi.Other'],
            name: `Institution #${edorg}`,
          })),
      })) || []
    );
  }

  private createODSObjectV1(tenant: PostSbEnvironmentTenantDTO): SbV1MetaOds[] {
    return (
      tenant.odss?.map((ods) => ({
        dbname: ods.dbName,
        edorgs: ods.allowedEdOrgs
          ?.split(',')
          .map((id) => id.trim())
          .filter((edorg) => edorg !== '' && !isNaN(Number(edorg)))
          .map((edorg) => ({
            educationorganizationid: parseInt(edorg),
            nameofinstitution: `Institution #${edorg}`,
            shortnameofinstitution: `I#${edorg}`,
            discriminator: EdorgType['edfi.Other'],
          })),
      })) || []
    );
  }

  private async saveSyncableOds(
    metaOds: SbV2MetaOds[],
    tenantEntity: { name: string; sbEnvironmentId: number } & EdfiTenant
  ) {
    const odss = (metaOds ?? []).map(
      (o): SyncableOds => ({
        ...o,
        dbName: o.dbname,
      })
    );
    // Store the data in the localDB
    await this.entityManager.transaction((em) =>
      persistSyncTenant({ em, odss, edfiTenant: tenantEntity })
    );
  }

  private async saveSyncableOdsV1(
    metaOds: SbV1MetaOds[],
    tenantEntity: { name: string; sbEnvironmentId: number } & EdfiTenant
  ) {
    const odss = (metaOds ?? []).map(
      (o): SyncableOds => ({
        id: null, // V1 doesn't have id
        name: o.dbname, // Use dbname as name for V1
        dbName: o.dbname,
        edorgs: o.edorgs,
      })
    );
    // Store the data in the localDB
    await this.entityManager.transaction((em) =>
      persistSyncTenant({ em, odss, edfiTenant: tenantEntity })
    );
  }

  private async validateTenantsAndCreateCredentials(
    createSbEnvironmentDto: PostSbEnvironmentDto
  ): Promise<TenantCredentialsMap> {
    const credentialsMap = new Map<string, TenantCredentials>();
    const failedTenants: string[] = [];

    if (!createSbEnvironmentDto.tenants || createSbEnvironmentDto.tenants.length === 0) {
      throw new ValidationHttpException({
        field: 'tenants',
        message: 'At least one tenant is required for multi-tenant deployment',
      });
    }

    // Validate all tenants by creating credentials for each
    for (const tenant of createSbEnvironmentDto.tenants) {
      try {
        const credentials = await this.createClientCredentials(createSbEnvironmentDto, tenant.name);
        credentialsMap.set(tenant.name, credentials);
        this.logger.log(`Successfully validated tenant: ${tenant.name}`);
      } catch (error) {
        this.logger.error(`Failed to validate tenant: ${tenant.name}`, error);
        failedTenants.push(tenant.name);
      }
    }

    // If any tenants failed, throw an error with all failed tenant names
    if (failedTenants.length > 0) {
      const failedTenantList = failedTenants.join(', ');
      throw new ValidationHttpException({
        field: 'tenants',
        message: `The following tenant(s) do not exist or are not properly configured in the Admin API: ${failedTenantList}`,
      });
    }

    return credentialsMap;
  }

  private async createClientCredentials(
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenant?: string
  ): Promise<TenantCredentials> {
    const registerUrl = `${createSbEnvironmentDto.adminApiUrl}/connect/register`;
    const clientSecret = Array.from({ length: 32 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'.charAt(
        Math.floor(Math.random() * 70)
      )
    ).join('');
    const clientId = `client_${Math.random().toString(36).substring(2, 15)}`;
    const displayName = `AdminApp-v4-${Math.random().toString(36).substring(2, 8)}`;
    const formData = new URLSearchParams();
    formData.append('ClientId', clientId);
    formData.append('ClientSecret', clientSecret);
    formData.append('DisplayName', displayName);

    const headers =
      createSbEnvironmentDto.isMultitenant && createSbEnvironmentDto.version === 'v2'
        ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            tenant: tenant,
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
      this.logger.error('Failed to register client credentials:', error);

      // For multi-tenant v2 with tenant header, assume 400 errors are wrong tenant names
      if (createSbEnvironmentDto.isMultitenant && createSbEnvironmentDto.version === 'v2' && tenant && error.response?.status === 400) {
        throw new ValidationHttpException({
          field: 'tenants',
          message: `Tenant '${tenant}' does not exist or is not properly configured in the Admin API`,
        });
      }

      // For all other errors, treat as Admin API URL issues
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: error.message,
      });
    }
  }
}
