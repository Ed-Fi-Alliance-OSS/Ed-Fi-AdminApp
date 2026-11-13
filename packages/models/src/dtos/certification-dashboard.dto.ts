import { Expose, Type } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
import { CERT_RUN_STATUS } from './certification-run.dto';
import type { CertModel, CertRunStatus } from './certification-run.dto';

/** The "Runs in flight or rejected" list shows at most this many rows; `total` is the real count. */
export const CERT_DASHBOARD_OTHERS_LIMIT = 100;

/** Runs waiting for a reviewer. */
export const CERT_DASHBOARD_WAITING_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.READY_FOR_REVIEW,
  CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
];

/** Every status that is not waiting for review. Remove IN_REVIEW here to hide picked-up runs. */
export const CERT_DASHBOARD_OTHER_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.DRAFT,
  CERT_RUN_STATUS.IN_REVIEW,
  CERT_RUN_STATUS.CHANGES_REQUESTED,
  CERT_RUN_STATUS.APPROVED,
  CERT_RUN_STATUS.REJECTED,
];

export class CertificationDashboardCountsDto {
  @Expose()
  newlyReadyForReview: number;

  @Expose()
  readyWithNewChanges: number;

  @Expose()
  pickedUp: number;

  @Expose()
  runsInFlight: number;
}

export class CertificationDashboardRunDto {
  @Expose()
  runId: number;

  @Expose()
  teamName: string | null;

  @Expose()
  sbEnvironmentName: string;

  @Expose()
  edfiTenantName: string;

  @Expose()
  dataStore: string | null;

  @Expose()
  certificationModel: CertModel;

  @Expose()
  status: CertRunStatus;

  /** ISO string. */
  @Expose()
  statusChangedAt: string;

  /** ISO string. */
  @Expose()
  updatedAt: string;
}

export class CertificationDashboardListDto {
  @Expose()
  @Type(() => CertificationDashboardRunDto)
  rows: CertificationDashboardRunDto[];

  @Expose()
  total: number;
}

export class CertificationDashboardDto {
  @Expose()
  @Type(() => CertificationDashboardCountsDto)
  counts: CertificationDashboardCountsDto;

  @Expose()
  @Type(() => CertificationDashboardListDto)
  waiting: CertificationDashboardListDto;

  @Expose()
  @Type(() => CertificationDashboardListDto)
  others: CertificationDashboardListDto;
}

export const toCertificationDashboardDto = makeSerializer<
  CertificationDashboardDto,
  CertificationDashboardDto
>(CertificationDashboardDto);
