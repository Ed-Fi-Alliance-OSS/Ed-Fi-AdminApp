import { AddEdorgDtoV2, EducationOrganizationDto } from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment, regarding } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CustomHttpException, ValidationHttpException } from '../../../utils';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { persistSyncOds, SyncableOds } from '../../../sb-sync/sync-ods';
import { AdminApiServiceV2 } from '../starting-blocks/v2/admin-api.v2.service';
import { EdorgType } from '@edanalytics/models';

@Injectable()
export class EdorgsService {
  private readonly logger = new Logger(EdorgsService.name);

  constructor(
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    @InjectRepository(Ods)
    private odsRepository: Repository<Ods>,
    private sbServiceV2: StartingBlocksServiceV2,
    private adminApiServiceV2: AdminApiServiceV2,
    private dataSource: DataSource
  ) {}

  findAll(edfiTenantId: EdfiTenant['id']) {
    return this.edorgsRepository.findBy({ edfiTenantId });
  }

  findOne(id: number) {
    return this.edorgsRepository.findOneBy({ id });
  }

  async add(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant, dto: AddEdorgDtoV2) {
    const addResult = await this.sbServiceV2.createEdorg(sbEnvironment, edfiTenant, dto);

    if (addResult.status === 'ALREADY_EXISTS') {
      throw new ValidationHttpException({
        field: 'EdOrgId',
        message: 'Education organization already exists in ODS',
      });
    }
    if (addResult.status === 'NO_CONFIG') {
      throw new CustomHttpException(
        {
          title: 'Bad system configuration',
          message: 'Check function ARNs or report this error.',
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
    if (addResult.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to add education organization',
          message: addResult.data?.errorMessage,
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
    return undefined;
  }

  async remove(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant,
    odsName: string,
    educationOrganizationId: string
  ) {
    const addResult = await this.sbServiceV2.deleteEdorg(
      sbEnvironment,
      edfiTenant,
      odsName,
      educationOrganizationId
    );

    if (addResult.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to remove education organization',
          message: addResult.data?.errorMessage,
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
    return undefined;
  }

  /**
   * Sync all education organizations across all ODS instances for a tenant
   * Fetches Ed-Orgs from Admin API v2 and persists them to the database
   *
   * @param sbEnvironment - The Starting Blocks environment
   * @param edfiTenant - The tenant to sync Ed-Orgs for
   * @returns Summary of sync operation with counts
   */
  async syncAllEdOrgs(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant
  ): Promise<{ synced: number; skipped: number }> {
    this.logger.log(`Starting Ed-Org sync for tenant ${edfiTenant.name} (id=${edfiTenant.id})`);

    try {
      // Step 1: Fetch all Ed-Orgs from Admin API
      const allEdOrgs = await this.adminApiServiceV2.getAllEdOrgsForTenant(edfiTenant);
      this.logger.log(`Fetched ${allEdOrgs.length} Ed-Orgs from Admin API`);

      if (allEdOrgs.length === 0) {
        this.logger.log('No Ed-Orgs returned from Admin API, nothing to sync');
        return { synced: 0, skipped: 0 };
      }

      // Step 2: Group Ed-Orgs by odsInstanceId
      const edOrgsByInstance = new Map<number, EducationOrganizationDto[]>();
      allEdOrgs.forEach((edOrg) => {
        if (edOrg.instanceId !== null && edOrg.instanceId !== undefined) {
          if (!edOrgsByInstance.has(edOrg.instanceId)) {
            edOrgsByInstance.set(edOrg.instanceId, []);
          }
          edOrgsByInstance.get(edOrg.instanceId).push(edOrg);
        } else {
          this.logger.warn(
            `Ed-Org ${edOrg.educationOrganizationId} has no instanceId, skipping`
          );
        }
      });

      this.logger.log(
        `Grouped Ed-Orgs into ${edOrgsByInstance.size} ODS instance(s)`
      );

      // Step 3: Find matching ODS entities and sync
      let syncedCount = 0;
      let skippedCount = 0;

      for (const [odsInstanceId, edOrgs] of edOrgsByInstance.entries()) {
        const ods = await this.odsRepository.findOne({
          where: {
            edfiTenantId: edfiTenant.id,
            odsInstanceId: odsInstanceId,
          },
        });

        if (!ods) {
          this.logger.warn(
            `No ODS entity found for odsInstanceId ${odsInstanceId}, skipping ${edOrgs.length} Ed-Org(s)`
          );
          skippedCount += edOrgs.length;
          continue;
        }

        // Step 4: Persist Ed-Orgs for this ODS instance
        this.logger.log(
          `Syncing ${edOrgs.length} Ed-Org(s) for ODS instance ${odsInstanceId} (dbName: ${ods.dbName})`
        );

        const syncableOds: SyncableOds = {
          id: odsInstanceId,
          name: ods.odsInstanceName,
          dbName: ods.dbName,
          edorgs: edOrgs.map((edOrg) => ({
            educationorganizationid: Number(edOrg.educationOrganizationId),
            nameofinstitution: edOrg.nameOfInstitution,
            shortnameofinstitution: edOrg.shortNameOfInstitution,
            discriminator: edOrg.discriminator as EdorgType,
            edorgs: [], // Flat structure, no nested children from this endpoint
          })),
        };

        await this.dataSource.transaction(async (em) => {
          const result = await persistSyncOds({
            em,
            edfiTenant,
            ods: syncableOds,
          });

          if (result.status === 'SUCCESS') {
            const changesCount =
              result.data.edorg.inserted +
              result.data.edorg.updated +
              result.data.edorg.deleted;
            syncedCount += edOrgs.length;
            this.logger.log(
              `Successfully synced ${edOrgs.length} Ed-Org(s) for ODS ${odsInstanceId} ` +
              `(${result.data.edorg.inserted} inserted, ${result.data.edorg.updated} updated, ${result.data.edorg.deleted} deleted)`
            );
          }
        });
      }

      this.logger.log(
        `Ed-Org sync completed for tenant ${edfiTenant.name}: ${syncedCount} synced, ${skippedCount} skipped`
      );

      return { synced: syncedCount, skipped: skippedCount };
    } catch (error) {
      this.logger.error(
        `Error syncing Ed-Orgs for tenant ${edfiTenant.name}: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        {
          title: 'Failed to sync education organizations',
          message: error.message || 'An error occurred during sync',
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
  }
}
