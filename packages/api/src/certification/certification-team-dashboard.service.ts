import {
  CERT_MODEL,
  CertificationTeamDashboardDataStoreDto,
  CertificationTeamDashboardDto,
  Ids,
  toCertificationTeamDashboardCounts,
} from '@edanalytics/models';
import { CertificationRun } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { checkId } from '../auth/helpers/where-ids';

const MODEL_ORDER: string[] = Object.values(CERT_MODEL);

/**
 * Read-only data behind the vendor "My products" dashboard (AC-671): the latest run of each model
 * on each data store the user can read, plus counts computed from those same runs.
 */
@Injectable()
export class CertificationTeamDashboardService {
  constructor(
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>
  ) {}

  async getDashboard(params: {
    teamId: number;
    validOdsIds: (edfiTenantId: number) => Ids | undefined;
  }): Promise<CertificationTeamDashboardDto> {
    const grouped: {
      edfiTenantId: number | string;
      odsId: number | string;
      certificationModel: string;
      maxId: number | string;
    }[] = await this.runRepository
      .createQueryBuilder('run')
      .select('run.edfiTenantId', 'edfiTenantId')
      .addSelect('run.odsId', 'odsId')
      .addSelect('run.certificationModel', 'certificationModel')
      .addSelect('MAX(run.certificationRunId)', 'maxId')
      .where('run.teamId = :teamId AND run.odsId IS NOT NULL', { teamId: params.teamId })
      .groupBy('run.edfiTenantId')
      .addGroupBy('run.odsId')
      .addGroupBy('run.certificationModel')
      .getRawMany();

    // MAX comes back as a string on one engine and a number on the other.
    const runIds = grouped
      .filter((row) => {
        const ids = params.validOdsIds(Number(row.edfiTenantId));
        return ids !== undefined && checkId(Number(row.odsId), ids);
      })
      .map((row) => Number(row.maxId));

    if (runIds.length === 0) {
      return { counts: toCertificationTeamDashboardCounts([]), dataStores: [] };
    }

    const runs = await this.runRepository.find({
      where: { certificationRunId: In(runIds) },
      relations: { ods: true, edfiTenant: { sbEnvironment: true } },
    });

    const byDataStore = new Map<string, CertificationTeamDashboardDataStoreDto>();
    for (const run of runs) {
      const key = `${run.edfiTenantId}:${run.odsId}`;
      let dataStore = byDataStore.get(key);
      if (!dataStore) {
        dataStore = {
          edfiTenantId: run.edfiTenantId,
          odsId: run.odsId as number,
          environmentName: run.edfiTenant?.sbEnvironment?.displayName ?? '',
          tenantName: run.edfiTenant?.displayName ?? '',
          dataStoreName: run.ods?.displayName ?? '',
          runs: [],
        };
        byDataStore.set(key, dataStore);
      }
      dataStore.runs.push({
        runId: run.certificationRunId,
        certificationModel: run.certificationModel,
        status: run.status,
      });
    }

    const dataStores = [...byDataStore.values()].sort(
      (a, b) =>
        a.environmentName.localeCompare(b.environmentName) ||
        a.tenantName.localeCompare(b.tenantName) ||
        a.dataStoreName.localeCompare(b.dataStoreName)
    );
    for (const dataStore of dataStores) {
      dataStore.runs.sort(
        (a, b) =>
          MODEL_ORDER.indexOf(a.certificationModel) - MODEL_ORDER.indexOf(b.certificationModel)
      );
    }

    return { counts: toCertificationTeamDashboardCounts(runs.map((r) => r.status)), dataStores };
  }
}
