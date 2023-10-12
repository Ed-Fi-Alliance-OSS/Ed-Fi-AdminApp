import { GetUserDto, SbMetaEdorg, SbMetaOds, toOperationResultDto } from '@edanalytics/models';
import { Edorg, Ods, Sbe, addUserCreating, regarding } from '@edanalytics/models-server';
import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import _ from 'lodash';
import PgBoss from 'pg-boss';
import { DeepPartial, EntityManager, In, Repository } from 'typeorm';
import { CacheService } from '../app/cache.module';
import { AuthService } from '../auth/auth.service';
import { StartingBlocksService } from '../tenants/sbes/starting-blocks/starting-blocks.service';
import { CustomHttpException } from '../utils/customExceptions';
import { PgBossInstance, SYNC_CHNL, SYNC_SCHEDULER_CHNL } from './sb-sync.module';

@Injectable()
export class SbSyncConsumer implements OnModuleInit {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @Inject('PgBossInstance')
    private readonly boss: PgBossInstance,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly sbService: StartingBlocksService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CacheService) private cacheManager: CacheService
  ) {}

  public async onModuleInit() {
    this.boss.on('error', (error) => Logger.error(error));

    await this.boss.schedule(SYNC_SCHEDULER_CHNL, config.SB_SYNC_CRON, null, {
      tz: 'America/Chicago',
    });

    await this.boss.work(SYNC_SCHEDULER_CHNL, async () => {
      const sbes = await this.getEligibleSbes();
      Logger.log(`Starting sync for ${sbes.length} environments.`);
      await Promise.all(
        sbes.map((sbe) =>
          this.boss.send(
            SYNC_CHNL,
            { sbeId: sbe.id },
            { singletonKey: String(sbe.id), expireInHours: 1 }
          )
        )
      );
    });

    await this.boss.work(SYNC_CHNL, async (job: PgBoss.Job<{ sbeId: number }>) => {
      return this.refreshResources(job.data.sbeId, undefined);
    });
  }

  public async getEligibleSbes() {
    return this.sbesRepository.find();
  }

  async refreshResources(sbeId: number, user: GetUserDto | undefined) {
    type SbMetaEdorgFlat = SbMetaEdorg & {
      dbname: SbMetaOds['dbname'];
      parent?: SbMetaEdorg['educationorganizationid'];
    };
    const sbOdss: SbMetaOds[] = [];
    const sbEdorgs: SbMetaEdorgFlat[] = [];
    let sbe: Sbe;

    try {
      sbe = await this.sbesRepository.findOneByOrFail({ id: sbeId });
    } catch (notFound) {
      throw new NotFoundException(`SBE ${sbeId} not found`);
    }

    const sbMeta = await this.sbService.getSbMeta(sbe);
    if (sbMeta.status === 'INVALID_ARN') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Metadata retrieval failed.',
          message: 'Invalid ARN for metadata lambda function.',
          regarding: regarding(sbe),
        },
        500
      );
    } else if (sbMeta.status === 'FAILURE') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Matadata retrieval failed.',
          message: sbMeta.error,
          regarding: regarding(sbe),
        },
        500
      );
    } else if (sbMeta.status === 'SUCCESS') {
      Logger.verbose('Metadata retrieval succeeded.');
      const sbMetaValue = sbMeta.data;
      try {
        sbOdss.push(...(sbMetaValue.odss ?? []));
        sbMetaValue.odss?.forEach((ods) => {
          const pushEdOrgs = (
            edorg: SbMetaEdorg,
            parent?: SbMetaEdorg['educationorganizationid']
          ) => {
            const edorgFlat = {
              ...edorg,
              dbname: ods.dbname,
              parent,
            };
            sbEdorgs.push(edorgFlat);
            edorg.edorgs?.forEach((childEdorg) =>
              pushEdOrgs(childEdorg, edorgFlat.educationorganizationid)
            );
          };
          ods.edorgs?.forEach((edorg) => pushEdOrgs(edorg));
        });

        return await this.entityManager
          .transaction(async (em) => {
            const odsRepo = em.getRepository(Ods);
            const edorgRepo = em.getRepository(Edorg);

            const existingOdss = await odsRepo.find({
              where: {
                sbeId,
              },
            });

            const odssToDelete = new Set(existingOdss.map((o) => o.id));
            /**
             * get ods ID given ods dbname
             */
            const odsMap = Object.fromEntries(existingOdss.map((o) => [o.dbName, o]));
            const newOdss = sbOdss.flatMap((sbOds) => {
              if (sbOds.dbname in odsMap) {
                const id = odsMap[sbOds.dbname].id;
                if (id === undefined) {
                  Logger.error('ODS id-dbName map failed');
                }
                odssToDelete.delete(id);
                return [];
              } else {
                return [
                  addUserCreating(
                    odsRepo.create({
                      sbeId,
                      dbName: sbOds.dbname,
                    }),
                    user
                  ),
                ];
              }
            });

            (await odsRepo.save(newOdss)).forEach((ods) => {
              odsMap[ods.dbName] = ods;
            });

            await odsRepo.delete({
              id: In([...odssToDelete.values()]),
            });

            const existingEdorgs = await edorgRepo.find({
              where: {
                sbeId,
              },
            });

            /**
             * get edorg ID given ods ID and edorg educationorganizationid
             */
            const odsEdorgMap = Object.fromEntries(
              Object.values(odsMap).map((ods) => [ods.id, new Map<number, Edorg>()])
            );

            existingEdorgs.forEach((edorg) => {
              odsEdorgMap[edorg.odsId].set(edorg.educationOrganizationId, edorg);
            });
            const edorgsToSave: DeepPartial<Edorg>[] = [];

            sbEdorgs.forEach((sbeEdorg) => {
              const partialEdorgEntity: Partial<Edorg> = {
                sbeId,
                odsId: odsMap[sbeEdorg.dbname].id,
                odsDbName: sbeEdorg.dbname,
                educationOrganizationId: sbeEdorg.educationorganizationid,
                discriminator: sbeEdorg.discriminator,
                nameOfInstitution: sbeEdorg.nameofinstitution,
                shortNameOfInstitution: sbeEdorg.shortnameofinstitution,
              };
              if (
                !odsEdorgMap[partialEdorgEntity.odsId]?.has(
                  partialEdorgEntity.educationOrganizationId
                )
              ) {
                edorgsToSave.push(edorgRepo.create(addUserCreating(partialEdorgEntity, user)));
              }
            });
            const newEdorgs = await edorgRepo.save(edorgsToSave);
            newEdorgs.forEach((edorg) => {
              odsEdorgMap[edorg.odsId].set(edorg.educationOrganizationId, edorg);
            });

            const edorgsToDelete: Set<number> = new Set(existingEdorgs.map((e) => e.id));
            const edorgsToUpdate: Edorg[] = [];

            sbEdorgs.forEach((sbEdorg) => {
              const existing = odsEdorgMap[odsMap[sbEdorg.dbname].id].get(
                sbEdorg.educationorganizationid
              );
              const parent: Edorg | undefined = odsEdorgMap[odsMap[sbEdorg.dbname].id].get(
                sbEdorg.parent
              );
              const correctValues: DeepPartial<Edorg> = {
                ...(parent ? { parentId: parent.id } : {}),
                discriminator: sbEdorg.discriminator,
                nameOfInstitution: sbEdorg.nameofinstitution,
                shortNameOfInstitution: sbEdorg.shortnameofinstitution,
              };
              if (!_.isMatch(existing, correctValues)) {
                edorgsToUpdate.push(
                  Object.assign(
                    existing,
                    correctValues,
                    // TypeORM has to update the closure table using `parent` rather than `parentId` for some reason
                    parent ? { parentId: undefined, parent } : {}
                  )
                );
              }
              edorgsToDelete.delete(existing.id);
            });

            await edorgRepo.save(edorgsToUpdate, { chunk: 100 });
            await edorgRepo.delete({
              id: In([...edorgsToDelete]),
            });
            await this.sbesRepository.save({
              ...sbe,
              envLabel: sbMetaValue.envlabel,
              configPublic: {
                ...sbe.configPublic,
                lastSuccessfulPull: new Date(),
                edfiHostname: sbMetaValue.domainName,
              },
            });

            if (newEdorgs.length || edorgsToDelete.size || newOdss.length || odssToDelete.size) {
              const activeCacheKeys = this.cacheManager.keys();
              const reloadCaches = async () => {
                const start = Number(new Date());
                const logger = setInterval(() => {
                  Logger.log(`Rebuilding tenant caches. ${Number(new Date()) - start}ms elapsed.`);
                });
                for (let i = 0; i < activeCacheKeys.length; i++) {
                  const key = activeCacheKeys[i];
                  await this.authService.reloadTenantOwnershipCache(Number(key));
                }
                clearInterval(logger);
              };
              reloadCaches();
            }

            return toOperationResultDto({
              title: `Sync succeeded`,
              type: 'Success',
              message: `${sbEdorgs.length} total Ed-Orgs (${newEdorgs.length} added, ${edorgsToDelete.size} deleted), ${sbOdss.length} total ODS's. (${newOdss.length} added, ${odssToDelete.size} deleted).`,
              regarding: regarding(sbe),
            });
          })
          .catch(async (err) => {
            // Log the failure on the Sbe entity...
            await this.sbesRepository.save({
              ...sbe,
              configPublic: {
                ...sbe.configPublic,
                lastFailedPull: new Date(),
              },
            });
            // ...but then continue the Exception
            throw err;
          });
      } catch (TransformationErr) {
        Logger.log(TransformationErr);
        throw new CustomHttpException(
          {
            type: 'Error',
            title: 'Unexpected error in transformation and sync.',
            regarding: regarding(sbe),
          },
          500
        );
      }
    }
  }
}
