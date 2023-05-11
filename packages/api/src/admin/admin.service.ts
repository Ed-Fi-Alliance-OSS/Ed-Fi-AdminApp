import { GetUserDto, SbMetaEdorg, SbMetaOds } from '@edanalytics/models';
import {
  Edorg,
  Ods,
  Resource,
  Sbe,
  User,
  addUserCreating,
} from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { DeepPartial, EntityManager, In, Not, Repository } from 'typeorm';
import { StartingBlocksServiceMock } from '../starting-blocks/starting-blocks.service.mock';

@Injectable()
export class AdminService {
  constructor(
    private readonly sbService: StartingBlocksServiceMock,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  async sbeRefreshResources(sbeId: number, user: GetUserDto) {
    await this.entityManager.transaction(async (em) => {
      const odsRepo = em.getRepository(Ods);
      const edorgRepo = em.getRepository(Edorg);
      const resourceRepo = em.getRepository(Resource);

      type SbMetaEdorgFlat = SbMetaEdorg & {
        dbname: SbMetaOds['dbname'];
        parent?: SbMetaEdorg['educationorganizationid'];
      };
      const sbOdss: SbMetaOds[] = [];
      const sbEdorgs: SbMetaEdorgFlat[] = [];

      const sbMeta = await this.sbService.getSbMeta(sbeId);
      sbOdss.push(...(sbMeta.odss ?? []));
      sbMeta.odss?.forEach((ods) => {
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

      const existingOdss = await odsRepo.find({
        where: {
          sbeId,
        },
      });

      const resourceIdsToDelete = new Set(
        existingOdss.map((o) => o.resourceId)
      );

      /**
       * get ods ID given ods dbname
       */
      const odsMap = Object.fromEntries(existingOdss.map((o) => [o.dbName, o]));
      const newOdsResources = sbOdss.flatMap((sbOds) => {
        if (sbOds.dbname in odsMap) {
          resourceIdsToDelete.delete(odsMap[sbOds.dbname].resourceId);
          return [];
        } else {
          return [
            addUserCreating(
              resourceRepo.create({
                ods: addUserCreating(
                  odsRepo.create({
                    sbeId,
                    dbName: sbOds.dbname,
                  }),
                  user
                ),
              }),
              user
            ),
          ];
        }
      });

      (await resourceRepo.save(newOdsResources)).forEach((resource) => {
        odsMap[resource.ods.dbName] = resource.ods;
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
        Object.values(odsMap).map((ods) => [ods.id, new Map<string, Edorg>()])
      );

      existingEdorgs.forEach((edorg) => {
        odsEdorgMap[edorg.odsId].set(edorg.educationOrganizationId, edorg);
      });
      const edorgsToSave: DeepPartial<Edorg>[] = [];

      sbEdorgs.map((sbeEdorg) => {
        const partialEdorgEntity: Partial<Edorg> = {
          sbeId,
          odsId: odsMap[sbeEdorg.dbname].id,
          // parentId: odsEdorgMap[odsMap[sbeEdorg.dbname]].get(String(sbeEdorg.educationorganizationid))?.id,
          educationOrganizationId: String(sbeEdorg.educationorganizationid),
          discriminator: sbeEdorg.discriminator,
          nameOfInstitution: sbeEdorg.nameofinstitution,
        };
        if (
          !odsEdorgMap[partialEdorgEntity.odsId]?.has(
            partialEdorgEntity.educationOrganizationId
          )
        ) {
          edorgsToSave.push(addUserCreating(partialEdorgEntity, user));
        }
      });
      const newResources = await resourceRepo.save(
        edorgsToSave.map((edorg) =>
          addUserCreating(
            resourceRepo.create({
              edorg,
            }),
            user
          )
        )
      );
      const newEdorgs = await edorgRepo.find({
        where: {
          resourceId: In(newResources.map((r) => r.id)),
        },
      });

      newEdorgs.forEach((edorg) => {
        odsEdorgMap[edorg.odsId].set(edorg.educationOrganizationId, edorg);
      });

      const edorgResourceIdsToDelete: Set<number> = new Set(
        existingEdorgs.map((e) => e.resourceId)
      );
      const edorgsToUpdate: DeepPartial<Edorg>[] = [];

      sbEdorgs.forEach((sbEdorg) => {
        const existing = odsEdorgMap[odsMap[sbEdorg.dbname].id].get(
          String(sbEdorg.educationorganizationid)
        );
        const parent: Edorg | undefined = odsEdorgMap[
          odsMap[sbEdorg.dbname].id
        ].get(String(sbEdorg.parent));
        const correctValues: DeepPartial<Edorg> = {
          parentId: parent?.id ?? null,
          discriminator: sbEdorg.discriminator,
          nameOfInstitution: sbEdorg.nameofinstitution,
        };
        if (!_.isMatch(existing, correctValues)) {
          edorgsToUpdate.push({
            ...existing,
            ...correctValues,
          });
        }
        edorgResourceIdsToDelete.delete(existing.resourceId);
      });

      await edorgRepo.save(edorgsToUpdate);
      // await resourceRepo.remove(
      //   await resourceRepo.find({
      //     where: {
      //       id: In([...edorgResourceIdsToDelete]),
      //     },
      //   })
      // );
    });
  }
}
