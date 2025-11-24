import { SbV1MetaEdorg } from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods } from '@edanalytics/models-server';
import { Logger } from '@nestjs/common';
import _ from 'lodash';
import { DeepPartial, EntityManager } from 'typeorm';

export type DeltaCounts = {
  inserted: number;
  updated: number;
  deleted: number;
};

export type SyncableOds = {
  id: number | null;
  name: string | null;
  dbName: string;
  edorgs?: SbV1MetaEdorg[];
};

export type SyncableEdorgFlat = SbV1MetaEdorg & {
  parent?: SbV1MetaEdorg['educationorganizationid'];
};

export const computeOdsListDeltas = (
  shouldHaveOdss: SyncableOds[],
  doHaveOdss: Ods[],
  edfiTenant: EdfiTenant,
  em: EntityManager
) => {
  const odsDeltas = {
    insert: [] as Ods[],
    update: [] as Ods[],
    delete: [] as number[],
  };

  const metaOdss = new Map(shouldHaveOdss.map((o) => [o.dbName, o]));

  /** Initially all ODSs, present ones dynamically removed */
  const odsIdsToDelete = new Set(doHaveOdss.map((o) => o.id));
  const odsMap = new Map<string, Ods>(doHaveOdss.map((o) => [o.dbName, o]));
  [...metaOdss.values()].forEach((sbOds) => {
    const newOds: DeepPartial<Ods> = {
      sbEnvironmentId: edfiTenant.sbEnvironmentId,
      edfiTenantId: edfiTenant.id,
      dbName: sbOds.dbName,
      odsInstanceId: sbOds.id,
      odsInstanceName: sbOds.name,
    };
    if (odsMap.has(sbOds.dbName)) {
      const existingOds = odsMap.get(sbOds.dbName);
      odsIdsToDelete.delete(existingOds.id);

      if (existingOds.odsInstanceId !== sbOds.id) {
        Logger.log(
          `Encountered unexpected case of modified odsInstanceId: ${sbOds.dbName} from ${existingOds.odsInstanceId} to ${sbOds.id}`
        );
        odsDeltas.update.push(Object.assign(existingOds, newOds));
      }
    } else {
      odsDeltas.insert.push(em.getRepository(Ods).create(newOds));
    }
  });

  odsDeltas.delete = [...odsIdsToDelete.values()];

  return odsDeltas;
};

export const computeOdsTreeDeltas = (
  edfiTenant: EdfiTenant,
  odsMeta: SyncableOds,
  odsEntity: Ods,
  existingEdorgs: Edorg[],
  /** probably from a transaction shared with other operations */
  em: EntityManager
) => {
  const metaEdorgs: SyncableEdorgFlat[] = [];

  const flattenEdorgTree = (
    edorg: SbV1MetaEdorg,
    parent?: SbV1MetaEdorg['educationorganizationid']
  ) => {
    const edorgFlat = {
      ...edorg,
      educationorganizationid: Number(edorg.educationorganizationid),
      parent,
    };
    delete edorgFlat.edorgs;
    metaEdorgs.push(edorgFlat);
    edorg.edorgs?.forEach((childEdorg) =>
      flattenEdorgTree(childEdorg, Number(edorgFlat.educationorganizationid))
    );
  };
  odsMeta.edorgs?.forEach((edorg) => flattenEdorgTree(edorg));

  const edorgRepo = em.getRepository(Edorg);

  const edorgMap = new Map<number, Edorg>();

  existingEdorgs.forEach((edorg) => {
    edorgMap.set(edorg.educationOrganizationId, edorg);
  });
  const edorgsToUpdate = new Map<number, Edorg>();
  const edorgsToInsert = new Map<number, Edorg>();

  // create new entities as necessary
  metaEdorgs.forEach((edfiTenantEdorg) => {
    if (!edorgMap.has(edfiTenantEdorg.educationorganizationid)) {
      const partialEdorgEntity: Partial<Edorg> = {
        edfiTenantId: edfiTenant.id,
        sbEnvironmentId: edfiTenant.sbEnvironmentId,
        ods: odsEntity,
        odsDbName: odsEntity.dbName,
        odsInstanceId: odsEntity.odsInstanceId,
        educationOrganizationId: edfiTenantEdorg.educationorganizationid,
        discriminator: edfiTenantEdorg.discriminator,
        nameOfInstitution: edfiTenantEdorg.nameofinstitution,
        shortNameOfInstitution: edfiTenantEdorg.shortnameofinstitution,
      };
      const newEdorg = edorgRepo.create(partialEdorgEntity);
      edorgsToInsert.set(partialEdorgEntity.educationOrganizationId, newEdorg);
      edorgMap.set(partialEdorgEntity.educationOrganizationId, newEdorg);
    }
  });

  // still-present ones are removed below
  const edorgsToDelete: Set<number> = new Set(existingEdorgs.map((e) => e.id));

  // update existing entities and set parent for new entities created above
  metaEdorgs.forEach((metaEdorg) => {
    const existing = edorgMap.get(metaEdorg.educationorganizationid);
    const parent: Edorg | undefined = edorgMap.get(metaEdorg.parent);
    const correctValues: DeepPartial<Edorg> = {
      discriminator: metaEdorg.discriminator,
      nameOfInstitution: metaEdorg.nameofinstitution,
      shortNameOfInstitution: metaEdorg.shortnameofinstitution,
    };
    let isChanged = false;
    if (parent) {
      // can only set parents once all individually created above. thus the check below for insert vs true update
      if (parent.id !== undefined) {
        correctValues.parentId = parent.id;
        isChanged = !_.isMatch(existing, correctValues);
      } else {
        // new parent
        isChanged = true;
      }
    } else {
      isChanged = !_.isMatch(existing, correctValues);
    }
    if (isChanged) {
      const updated = Object.assign(
        existing,
        correctValues,
        // TypeORM has to update the closure table using `parent` entity rather than `parentId` number for some reason
        parent ? { parent } : {}
      );
      if (edorgsToInsert.has(existing.educationOrganizationId)) {
        edorgsToInsert.set(existing.educationOrganizationId, updated);
      } else {
        edorgsToUpdate.set(existing.educationOrganizationId, updated);
      }
    }
    edorgsToDelete.delete(existing.id);
    if (typeof existing.id !== 'number') {
      // don't count as update because it's actually an insertion
    }
  });

  return {
    insert: [...edorgsToInsert.values()],
    update: [...edorgsToUpdate.values()],
    delete: [...edorgsToDelete],
  };
}; /* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

export const persistSyncTenant = async ({
  em,
  edfiTenant,
  odss,
}: {
  em: EntityManager;
  edfiTenant: EdfiTenant;
  odss: SyncableOds[];
}) => {
  const edorgDeltas = {
    insert: [] as Edorg[],
    update: [] as Edorg[],
    delete: [] as number[],
  };
  let odsDeltas = {
    insert: [] as Ods[],
    update: [] as Ods[],
    delete: [] as number[],
  };
  const metaOdss = new Map(odss.map((o) => [o.dbName, o]));
  const existingOdss = await em.getRepository(Ods).find({
    where: {
      edfiTenantId: edfiTenant.id,
    },
  });

  odsDeltas = computeOdsListDeltas(odss, existingOdss, edfiTenant, em);

  const entityOdss = new Map(
    (await em.getRepository(Ods).find({ where: { edfiTenantId: edfiTenant.id } })).map((o) => [
      o.dbName,
      o,
    ])
  );
  [...odsDeltas.insert, ...odsDeltas.update].forEach((o) => {
    entityOdss.set(o.dbName, o);
  });
  const existingEdorgs = await em.getRepository(Edorg).find({
    where: {
      edfiTenantId: edfiTenant.id,
    },
  });

  const odsEdorgsMap = existingEdorgs.reduce((acc, edorg) => {
    if (edorg.odsId in acc) {
      acc[edorg.odsId].push(edorg);
    } else {
      acc[edorg.odsId] = [edorg];
    }
    return acc;
  }, {} as Record<number, Edorg[]>);

  for (const [dbname, ods] of metaOdss) {
    const odsResult = computeOdsTreeDeltas(
      edfiTenant,
      ods,
      entityOdss.get(dbname),
      odsEdorgsMap[entityOdss.get(dbname).id] ?? [],
      em
    );
    edorgDeltas.insert.push(...odsResult.insert);
    edorgDeltas.update.push(...odsResult.update);
    edorgDeltas.delete.push(...odsResult.delete);
  }

  if (odsDeltas.insert.length || odsDeltas.update.length) {
    const newOdss = await em
      .getRepository(Ods)
      .save([...odsDeltas.insert, ...odsDeltas.update], { chunk: 500 });
    const newOdsMap = new Map(newOdss.map((o) => [o.dbName, o]));
    for (const edorg of edorgDeltas.insert) {
      edorg.ods = newOdsMap.get(edorg.ods.dbName);
    }
  }

  odsDeltas.delete.length && (await em.getRepository(Ods).delete(odsDeltas.delete));

  let newRootEdorgs: Edorg[] = [];
  for (const edorg of edorgDeltas.insert) {
    if (!edorg.parent || typeof edorg.parent.id === 'number') {
      newRootEdorgs.push(edorg);
    } else {
      if (!edorg.parent.children) {
        edorg.parent.children = [];
      }
      edorg.parent.children.push(edorg);
    }
  }
  // TypeORM doesn't save a tree structure in one go. Need to save parents before children.
  const treeLevels: Edorg[][] = [];
  const putEdorgInLevel = (edorg: Edorg, level: number) => {
    if (!treeLevels[level]) {
      treeLevels[level] = [];
    }
    treeLevels[level].push(edorg);
    (edorg.children ?? []).forEach((child) => putEdorgInLevel(child, level + 1));
  };
  newRootEdorgs.forEach((edorg) => putEdorgInLevel(edorg, 0));

  for (const level of treeLevels) {
    newRootEdorgs = await em.getRepository(Edorg).save(level, { chunk: 500 });
  }
  // const newEdorgs = new Map<string, Edorg>();

  // const flattenEdorgTree = (edorg: Edorg) => {
  //   const children = [...(edorg.children ?? [])];
  //   delete edorg.children;
  //   newEdorgs.set(`${edorg.odsDbName}-${edorg.educationOrganizationId}`, edorg);
  //   children.forEach((child) => flattenEdorgTree(child));
  // };
  // newRootEdorgs.forEach((edorg) => flattenEdorgTree(edorg));

  edorgDeltas.update.length &&
    (await em.getRepository(Edorg).save(
      edorgDeltas.update /* .map((edorg) =>
        edorg.parent && typeof edorg.parent.id === undefined
          ? // need to reassign parent because save above doesn't mutate existing variables with new ids
            Object.assign(edorg, {
              parent: newEdorgs.get(
                `${edorg.parent.odsDbName}-${edorg.parent.educationOrganizationId}`
              ),
            })
          : edorg
      ) */,
      { chunk: 500 }
    ));

  edorgDeltas.delete.length && (await em.getRepository(Edorg).delete(edorgDeltas.delete));

  const data = {
    edorg: {
      inserted: edorgDeltas.insert.length,
      updated: edorgDeltas.update.length,
      deleted: edorgDeltas.delete.length,
    },
    ods: {
      inserted: odsDeltas.insert.length,
      updated: odsDeltas.update.length,
      deleted: odsDeltas.delete.length,
    },
  };
  let hasChanges = false;
  for (const key of ['ods', 'edorg']) {
    for (const subkey of ['inserted', 'updated', 'deleted']) {
      if (data[key][subkey] > 0) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) break;
  }

  return {
    status: 'SUCCESS' as const,
    data: { ...data, hasChanges },
  };
};

export const persistSyncOds = async ({
  em,
  edfiTenant,
  ods,
}: {
  em: EntityManager;
  edfiTenant: EdfiTenant;
  ods: SyncableOds;
}) => {
  const edorgDeltas = {
    insert: [] as Edorg[],
    update: [] as Edorg[],
    delete: [] as number[],
  };
  let odsCreated = false;
  let entityOds = await em.getRepository(Ods).findOneBy({
    edfiTenantId: edfiTenant.id,
    odsInstanceId: ods.id,
  });
  if (entityOds === null) {
    odsCreated = true;
    entityOds = await em.getRepository(Ods).save({
      sbEnvironmentId: edfiTenant.sbEnvironmentId,
      edfiTenantId: edfiTenant.id,
      dbName: ods.dbName,
      odsInstanceId: ods.id,
      odsInstanceName: ods.name,
    });
  }

  const existingEdorgs = await em.getRepository(Edorg).find({
    where: {
      edfiTenantId: edfiTenant.id,
    },
  });

  const odsResult = computeOdsTreeDeltas(edfiTenant, ods, entityOds, existingEdorgs, em);
  edorgDeltas.insert.push(...odsResult.insert);
  edorgDeltas.update.push(...odsResult.update);
  edorgDeltas.delete.push(...odsResult.delete);

  for (const edorg of edorgDeltas.insert) {
    edorg.ods = entityOds;
  }

  let newRootEdorgs: Edorg[] = [];
  for (const edorg of edorgDeltas.insert) {
    if (!edorg.parent || typeof edorg.parent.id === 'number') {
      newRootEdorgs.push(edorg);
    } else {
      if (!edorg.parent.children) {
        edorg.parent.children = [];
      }
      edorg.parent.children.push(edorg);
    }
  }
  // TypeORM doesn't save a tree structure in one go. Need to save parents before children.
  const treeLevels: Edorg[][] = [];
  const putEdorgInLevel = (edorg: Edorg, level: number) => {
    if (!treeLevels[level]) {
      treeLevels[level] = [];
    }
    treeLevels[level].push(edorg);
    (edorg.children ?? []).forEach((child) => putEdorgInLevel(child, level + 1));
  };
  newRootEdorgs.forEach((edorg) => putEdorgInLevel(edorg, 0));

  for (const level of treeLevels) {
    newRootEdorgs = await em.getRepository(Edorg).save(level, { chunk: 500 });
  }

  edorgDeltas.update.length &&
    (await em.getRepository(Edorg).save(edorgDeltas.update, { chunk: 500 }));

  edorgDeltas.delete.length && (await em.getRepository(Edorg).delete(edorgDeltas.delete));

  const data = {
    edorg: {
      inserted: edorgDeltas.insert.length,
      updated: edorgDeltas.update.length,
      deleted: edorgDeltas.delete.length,
    },
    ods: odsCreated
      ? {
          inserted: 1,
          updated: 0,
          deleted: 0,
        }
      : {
          inserted: 0,
          updated: 0,
          deleted: 0,
        },
  };
  let hasChanges = false;
  for (const key of ['ods', 'edorg']) {
    for (const subkey of ['inserted', 'updated', 'deleted']) {
      if (data[key][subkey] > 0) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) break;
  }

  return {
    status: 'SUCCESS' as const,
    data: { ...data, hasChanges },
  };
};

export const persistSyncDeleteOds = async ({
  ods,
  edfiTenant,
  em,
}: {
  ods: Ods;
  edfiTenant: EdfiTenant;
  em: EntityManager;
}) => {
  await em.getRepository(Ods).delete(ods.id);
  const edorgDeletResult = await em.getRepository(Edorg).delete({ odsId: ods.id });
  return {
    status: 'SUCCESS' as const,
    data: {
      edorg: {
        inserted: 0,
        updated: 0,
        deleted: edorgDeletResult.affected ?? 0,
      },
      ods: {
        inserted: 0,
        updated: 0,
        deleted: 1,
      },
      hasChanges: true,
    },
  };
};
