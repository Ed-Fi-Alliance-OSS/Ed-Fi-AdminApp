import {
  CERT_DASHBOARD_OTHERS_LIMIT,
  CERT_DASHBOARD_OTHER_STATUSES,
  CERT_DASHBOARD_WAITING_STATUSES,
  CERT_RUN_STATUS,
  CertificationDashboardCountsDto,
  CertificationDashboardDto,
  CertificationDashboardListDto,
  CertificationDashboardRunDto,
} from '@edanalytics/models';
import { CertificationRun } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Read-only data behind the global Certification dashboard (AC-672): review-status counts and two
 * run lists, across every team. Counts are accurate as of the request.
 */
@Injectable()
export class CertificationDashboardService {
  constructor(
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>,
  ) {}

  async getDashboard(): Promise<CertificationDashboardDto> {
    const [counts, waiting, others] = await Promise.all([
      this.getCounts(),
      this.getWaiting(),
      this.getOthers(),
    ]);
    return { counts, waiting, others };
  }

  private async getCounts(): Promise<CertificationDashboardCountsDto> {
    const raw: { status: string; count: string | number }[] = await this.runRepository
      .createQueryBuilder('run')
      .select('run.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('run.status')
      .getRawMany();
    // mssql returns COUNT as a number and pgsql as a string; CHANGES_REQUESTED is in no card.
    const byStatus = new Map(raw.map(({ status, count }) => [status, Number(count)]));
    const countOf = (status: string) => byStatus.get(status) ?? 0;
    return {
      newlyReadyForReview: countOf(CERT_RUN_STATUS.READY_FOR_REVIEW),
      readyWithNewChanges: countOf(CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES),
      pickedUp: countOf(CERT_RUN_STATUS.IN_REVIEW),
      runsInFlight: countOf(CERT_RUN_STATUS.DRAFT),
    };
  }

  private async getWaiting(): Promise<CertificationDashboardListDto> {
    const [runs, total] = await this.listQuery(CERT_DASHBOARD_WAITING_STATUSES)
      .orderBy('run.statusChangedAt', 'ASC')
      .addOrderBy('run.certificationRunId', 'ASC')
      .getManyAndCount();
    return { rows: runs.map(toRow), total };
  }

  private async getOthers(): Promise<CertificationDashboardListDto> {
    const [runs, total] = await this.listQuery(CERT_DASHBOARD_OTHER_STATUSES)
      .orderBy('run.updatedAt', 'DESC')
      .addOrderBy('run.certificationRunId', 'DESC')
      .take(CERT_DASHBOARD_OTHERS_LIMIT)
      .getManyAndCount();
    return { rows: runs.map(toRow), total };
  }

  private listQuery(statuses: readonly string[]) {
    return this.runRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.team', 'team')
      .leftJoinAndSelect('run.edfiTenant', 'edfiTenant')
      .leftJoinAndSelect('edfiTenant.sbEnvironment', 'sbEnvironment')
      .leftJoinAndSelect('run.ods', 'ods')
      .where('run.status IN (:...statuses)', { statuses });
  }
}

const toRow = (run: CertificationRun): CertificationDashboardRunDto => ({
  runId: run.certificationRunId,
  teamName: run.team?.name ?? null,
  sbEnvironmentName: run.edfiTenant.sbEnvironment.displayName,
  edfiTenantName: run.edfiTenant.name,
  dataStore: run.ods ? (run.ods.odsInstanceName ?? run.ods.dbName) : null,
  certificationModel: run.certificationModel,
  status: run.status,
  statusChangedAt: run.statusChangedAt.toISOString(),
  updatedAt: run.updatedAt.toISOString(),
});
