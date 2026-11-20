import { Expose, Type } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
import { CERT_RUN_STATUS, isOpenRunStatus } from './certification-run.dto';
import type { CertModel, CertRunStatus } from './certification-run.dto';

/** Runs waiting on the vendor. */
export const CERT_TEAM_DASHBOARD_WAITING_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.DRAFT,
  CERT_RUN_STATUS.CHANGES_REQUESTED,
];

/** Runs waiting on, or being looked at by, Ed-Fi. */
export const CERT_TEAM_DASHBOARD_REVIEW_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.READY_FOR_REVIEW,
  CERT_RUN_STATUS.IN_REVIEW,
  CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
];

export class CertificationTeamDashboardCountsDto {
  @Expose()
  waitingOnUs: number;

  @Expose()
  readyForReview: number;

  @Expose()
  executingNow: number;

  @Expose()
  certified: number;
}

export class CertificationTeamDashboardRunDto {
  @Expose()
  runId: number;

  @Expose()
  certificationModel: CertModel;

  @Expose()
  status: CertRunStatus;
}

export class CertificationTeamDashboardDataStoreDto {
  @Expose()
  edfiTenantId: number;

  @Expose()
  odsId: number;

  @Expose()
  environmentName: string;

  @Expose()
  tenantName: string;

  @Expose()
  dataStoreName: string;

  @Expose()
  @Type(() => CertificationTeamDashboardRunDto)
  runs: CertificationTeamDashboardRunDto[];
}

export class CertificationTeamDashboardDto {
  @Expose()
  @Type(() => CertificationTeamDashboardCountsDto)
  counts: CertificationTeamDashboardCountsDto;

  @Expose()
  @Type(() => CertificationTeamDashboardDataStoreDto)
  dataStores: CertificationTeamDashboardDataStoreDto[];
}

/** Counts the latest run of each (data store, model), one status per run. */
export const toCertificationTeamDashboardCounts = (
  statuses: readonly CertRunStatus[]
): CertificationTeamDashboardCountsDto => ({
  waitingOnUs: statuses.filter((s) => CERT_TEAM_DASHBOARD_WAITING_STATUSES.includes(s)).length,
  readyForReview: statuses.filter((s) => CERT_TEAM_DASHBOARD_REVIEW_STATUSES.includes(s)).length,
  executingNow: statuses.filter(isOpenRunStatus).length,
  certified: statuses.filter((s) => s === CERT_RUN_STATUS.APPROVED).length,
});

export const toCertificationTeamDashboardDto = makeSerializer<
  CertificationTeamDashboardDto,
  CertificationTeamDashboardDto
>(CertificationTeamDashboardDto);
