import { CERT_RUN_STATUS, CertModel, CertRunStatus } from './certification-run.dto';

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

export type CertificationDashboardCountsDto = {
  newlyReadyForReview: number;
  readyWithNewChanges: number;
  pickedUp: number;
  runsInFlight: number;
};

export type CertificationDashboardRunDto = {
  runId: number;
  teamName: string | null;
  sbEnvironmentName: string;
  edfiTenantName: string;
  dataStore: string | null;
  certificationModel: CertModel;
  status: CertRunStatus;
  /** ISO string. */
  statusChangedAt: string;
  /** ISO string. */
  updatedAt: string;
};

export type CertificationDashboardListDto = {
  rows: CertificationDashboardRunDto[];
  total: number;
};

export type CertificationDashboardDto = {
  counts: CertificationDashboardCountsDto;
  waiting: CertificationDashboardListDto;
  others: CertificationDashboardListDto;
};
