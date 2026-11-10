import { Expose } from 'class-transformer';

/** Where a certification run is in its workflow. Not the same as a scenario's or step's result status. */
export const CERT_RUN_STATUS = {
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  IN_REVIEW: 'IN_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  READY_FOR_REVIEW_WITH_CHANGES: 'READY_FOR_REVIEW_WITH_CHANGES',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type CertRunStatus = (typeof CERT_RUN_STATUS)[keyof typeof CERT_RUN_STATUS];

export const CERT_MODEL = { sis: 'SIS', mtss: 'MTSS', assessments: 'ASSESSMENTS' } as const;
export type CertModel = (typeof CERT_MODEL)[keyof typeof CERT_MODEL];

/**
 * Approved and Rejected. A run in any other status is open, and a data store has at most one
 * open run per Certification Model. The unique indexes on cert.certification_run repeat these
 * two values, so change both together.
 */
export const CERT_RUN_CLOSED_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.APPROVED,
  CERT_RUN_STATUS.REJECTED,
];

export const isOpenRunStatus = (status: CertRunStatus): boolean =>
  !CERT_RUN_CLOSED_STATUSES.includes(status);

/** Steps run only while the vendor is working on the run. */
export const canExecuteSteps = (status: CertRunStatus): boolean =>
  status === CERT_RUN_STATUS.DRAFT || status === CERT_RUN_STATUS.CHANGES_REQUESTED;

/** Each status and the statuses it may move to. Any other change is refused. */
export const CERT_RUN_TRANSITIONS: Record<CertRunStatus, readonly CertRunStatus[]> = {
  [CERT_RUN_STATUS.DRAFT]: [CERT_RUN_STATUS.READY_FOR_REVIEW],
  [CERT_RUN_STATUS.CHANGES_REQUESTED]: [CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES],
  [CERT_RUN_STATUS.READY_FOR_REVIEW]: [CERT_RUN_STATUS.IN_REVIEW],
  [CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES]: [CERT_RUN_STATUS.IN_REVIEW],
  [CERT_RUN_STATUS.IN_REVIEW]: [
    CERT_RUN_STATUS.CHANGES_REQUESTED,
    CERT_RUN_STATUS.APPROVED,
    CERT_RUN_STATUS.REJECTED,
  ],
  [CERT_RUN_STATUS.APPROVED]: [],
  [CERT_RUN_STATUS.REJECTED]: [],
};

export const canTransitionRun = (from: CertRunStatus, to: CertRunStatus): boolean =>
  CERT_RUN_TRANSITIONS[from].includes(to);

const REVIEW_QUEUE_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.READY_FOR_REVIEW,
  CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
];

/** The status Send to Review moves a run to, or null when it can't be sent from `from`. */
export const sendToReviewStatus = (from: CertRunStatus): CertRunStatus | null =>
  CERT_RUN_TRANSITIONS[from].find((to) => REVIEW_QUEUE_STATUSES.includes(to)) ?? null;

/** A data store's open run, as the Certification pages need it. */
export class CertificationRunSummaryDto {
  @Expose()
  runId: number;

  @Expose()
  status: CertRunStatus;

  @Expose()
  canExecuteSteps: boolean;
}
