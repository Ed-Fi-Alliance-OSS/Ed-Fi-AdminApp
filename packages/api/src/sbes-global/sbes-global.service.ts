import {
  GetUserDto,
  OperationResultDto,
  PostSbeDto,
  PutSbeAdminApi,
  PutSbeAdminApiRegister,
  PutSbeMeta,
  SbMetaEdorg,
  SbMetaEnv,
  SbMetaOds,
  toOperationResultDto,
} from '@edanalytics/models';
import { Edorg, Ods, Ownership, Sbe, addUserCreating, regarding } from '@edanalytics/models-server';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { DeepPartial, EntityManager, In, Repository } from 'typeorm';
import { StartingBlocksService } from '../tenants/sbes/starting-blocks/starting-blocks.service';
import { ValidationError } from 'class-validator';
import { ValidationException, WorkflowFailureException } from '../utils/customExceptions';
import { StatusType, formErrFromValidator } from '@edanalytics/utils';
import { throwNotFound } from '../utils';

@Injectable()
export class SbesGlobalService {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>,
    private readonly sbService: StartingBlocksService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}
  create(createSbeDto: PostSbeDto) {
    return this.sbesRepository.save(this.sbesRepository.create(createSbeDto));
  }

  async findOne(id: number) {
    return this.sbesRepository.findOneByOrFail({ id });
  }

  async updateAdminApi(id: number, updateDto: PutSbeAdminApi) {
    const old = await this.findOne(id);
    return this.sbesRepository.save({
      ...old,
      modifiedById: updateDto.modifiedById,
      configPublic: {
        ...old.configPublic,
        adminApiKey: updateDto.adminKey,
        adminApiUrl: updateDto.adminUrl,
      },
      configPrivate: {
        ...old.configPrivate,
        adminApiSecret: updateDto.adminSecret,
      },
    });
  }

  async updateSbMeta(id: number, updateDto: PutSbeMeta) {
    const old = await this.findOne(id);
    return this.sbesRepository.save({
      ...old,
      modifiedById: updateDto.modifiedById,
      configPublic: {
        ...old.configPublic,
        sbeMetaKey: updateDto.metaKey,
        sbeMetaArn: updateDto.arn,
      },
      configPrivate: {
        ...old.configPrivate,
        sbeMetaSecret: updateDto.metaSecret,
      },
    });
  }

  async selfRegisterAdminApi(sbe: Sbe, updateDto: PutSbeAdminApiRegister) {
    const registrationResult = await this.sbService.selfRegisterAdminApi(
      updateDto.adminRegisterUrl
    );

    if (registrationResult.status === 'SUCCESS') {
      const { credentials } = registrationResult;
      return {
        status: registrationResult.status,
        result: await this.sbesRepository.save({
          ...sbe,
          modifiedById: updateDto.modifiedById,
          configPublic: {
            ...sbe.configPublic,
            adminApiKey: credentials.ClientId,
            adminApiUrl: updateDto.adminRegisterUrl,
            adminApiClientDisplayName: credentials.DisplayName,
          },
          configPrivate: {
            ...sbe.configPrivate,
            adminApiSecret: credentials.ClientSecret,
          },
        }),
      };
    } else {
      return registrationResult;
    }
  }

  async remove(id: number, user: GetUserDto) {
    const old = await this.findOne(id);
    await this.sbesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }

  async checkSbMeta(sbeId: number) {
    const sbe = await this.findOne(sbeId).catch(throwNotFound);
    const sbMetaResult = await this.sbService.getSbMeta(sbeId);
    const sbMeta = sbMetaResult.status === 'SUCCESS';

    await this.sbesRepository.save({
      ...sbe,
      configPublic: {
        ...sbe.configPublic,
        ...(sbMeta
          ? {
              lastSuccessfulConnectionSbMeta: new Date(),
            }
          : {
              lastFailedConnectionSbMeta: new Date(),
            }),
      },
    });

    if (sbMeta) {
      return toOperationResultDto({
        title: 'SB Metadata connection successful.',
        status: StatusType.success,
        regarding: regarding(sbe),
      });
    }

    const sbMetaMsg =
      sbMetaResult.status === 'INVALID_ARN'
        ? 'Invalid ARN provided for metadata function.'
        : sbMetaResult.error
        ? sbMetaResult.error
        : undefined;

    throw new WorkflowFailureException({
      title: 'SB Metadata connection unsuccessful.',
      status: StatusType.error,
      message: sbMetaMsg,
      regarding: regarding(sbe),
    });
  }

  async checkAdminAPI(sbeId: number) {
    const sbe = await this.findOne(sbeId).catch(throwNotFound);
    const loginResult = await this.sbService.logIntoAdminApi(sbe);
    const adminApi = loginResult.status === 'SUCCESS';

    await this.sbesRepository.save({
      ...sbe,
      configPublic: {
        ...sbe.configPublic,
        ...(adminApi
          ? {
              lastSuccessfulConnectionAdminApi: new Date(),
            }
          : {
              lastFailedConnectionAdminApi: new Date(),
            }),
      },
    });

    if (adminApi) {
      return toOperationResultDto({
        title: 'Admin API connection successful.',
        status: StatusType.success,
        regarding: regarding(sbe),
      });
    }

    const adminApiMsg =
      loginResult.status === 'INVALID_ADMIN_API_URL'
        ? 'Invalid URL.'
        : loginResult.status === 'NO_ADMIN_API_URL'
        ? 'No URL provided.'
        : loginResult.status === 'LOGIN_FAILED'
        ? 'Unknown failure.'
        : undefined;

    throw new WorkflowFailureException({
      title: 'Admin API connection unsuccessful.',
      status: StatusType.error,
      message: adminApiMsg,
      regarding: regarding(sbe),
    });
  }

  async refreshResources(sbeId: number, user: GetUserDto): Promise<OperationResultDto> {
    type SbMetaEdorgFlat = SbMetaEdorg & {
      dbname: SbMetaOds['dbname'];
      parent?: SbMetaEdorg['educationorganizationid'];
    };
    const sbOdss: SbMetaOds[] = [];
    const sbEdorgs: SbMetaEdorgFlat[] = [];
    let sbe: Sbe;

    try {
      sbe = await this.findOne(sbeId);
    } catch (notFound) {
      throw new NotFoundException();
    }

    const sbMeta = await this.sbService.getSbMeta(sbeId);
    if (sbMeta.status === 'INVALID_ARN') {
      throw new WorkflowFailureException({
        status: StatusType.error,
        title: 'Metadata retrieval failed.',
        message: 'Invalid ARN for metadata lambda function.',
        regarding: regarding(sbe),
      });
    }
    if (sbMeta.status === 'FAILURE') {
      throw new WorkflowFailureException({
        status: StatusType.error,
        title: 'Matadata retrieval failed.',
        message: sbMeta.error,
        regarding: regarding(sbe),
      });
    }
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

          const resourceIdsToDelete = new Set(existingOdss.map((o) => o.id));

          /**
           * get ods ID given ods dbname
           */
          const odsMap = Object.fromEntries(existingOdss.map((o) => [o.dbName, o]));
          const newOdsResources = sbOdss.flatMap((sbOds) => {
            if (sbOds.dbname in odsMap) {
              resourceIdsToDelete.delete(odsMap[sbOds.dbname].id);
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

          (await odsRepo.save(newOdsResources)).forEach((ods) => {
            odsMap[ods.dbName] = ods;
          });

          // await resourceRepo.remove(
          //   await resourceRepo.find({
          //     where: {
          //       id: In([...resourceIdsToDelete]),
          //     },
          //   })
          // );

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

          sbEdorgs.map((sbeEdorg) => {
            const partialEdorgEntity: Partial<Edorg> = {
              sbeId,
              odsId: odsMap[sbeEdorg.dbname].id,
              odsDbName: sbeEdorg.dbname,
              // parentId: odsEdorgMap[odsMap[sbeEdorg.dbname]].get(String(sbeEdorg.educationorganizationid))?.id,
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
              edorgsToSave.push(addUserCreating(partialEdorgEntity, user));
            }
          });
          const newEdorgs = await edorgRepo.save(
            edorgsToSave.map((edorg) => addUserCreating(edorg, user))
          );

          newEdorgs.forEach((edorg) => {
            odsEdorgMap[edorg.odsId].set(edorg.educationOrganizationId, edorg);
          });

          const edorgResourceIdsToDelete: Set<number> = new Set(existingEdorgs.map((e) => e.id));
          const edorgsToUpdate: Edorg[] = [];

          sbEdorgs.forEach((sbEdorg) => {
            const existing = odsEdorgMap[odsMap[sbEdorg.dbname].id].get(
              sbEdorg.educationorganizationid
            );
            const parent: Edorg | undefined = odsEdorgMap[odsMap[sbEdorg.dbname].id].get(
              sbEdorg.parent
            );
            const correctValues: DeepPartial<Edorg> = {
              ...(parent ? { parent } : {}),
              discriminator: sbEdorg.discriminator,
              nameOfInstitution: sbEdorg.nameofinstitution,
              shortNameOfInstitution: sbEdorg.shortnameofinstitution,
            };
            if (!_.isMatch(existing, correctValues)) {
              existing.discriminator = correctValues.discriminator;
              existing.nameOfInstitution = correctValues.nameOfInstitution;
              existing.shortNameOfInstitution = correctValues.shortNameOfInstitution;
              if (correctValues.parent) {
                existing.parent = parent;
              }
              edorgsToUpdate.push(existing);
            }
            edorgResourceIdsToDelete.delete(existing.id);
          });

          await edorgRepo.save(edorgsToUpdate);
          await edorgRepo.remove(
            await edorgRepo.find({
              where: {
                id: In([...edorgResourceIdsToDelete]),
              },
            })
          );
          await this.sbesRepository.save({
            ...sbe,
            envLabel: sbMetaValue.envlabel,
            configPublic: {
              ...sbe.configPublic,
              lastSuccessfulPull: new Date(),
              edfiHostname: sbMetaValue.domainName,
            },
          });
          return toOperationResultDto({
            title: `Sync succeeded`,
            status: StatusType.success,
            message: `${sbEdorgs.length} total Ed-Orgs, ${sbOdss.length} total ODS's.`,
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
      throw new WorkflowFailureException({
        status: StatusType.error,
        title: 'Unexpected error in transformation and sync.',
        regarding: regarding(sbe),
      });
    }
  }
}
