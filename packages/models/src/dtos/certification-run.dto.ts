import { Expose, Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
import { makeSerializer } from '../utils/make-serializer';

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

/** How each run status reads in the UI. Keep next to CERT_RUN_STATUS so a rename or removal fails to compile here. */
export const CERT_RUN_STATUS_LABELS: Record<CertRunStatus, string> = {
  [CERT_RUN_STATUS.DRAFT]: 'Draft',
  [CERT_RUN_STATUS.READY_FOR_REVIEW]: 'Ready for review',
  [CERT_RUN_STATUS.IN_REVIEW]: 'In review',
  [CERT_RUN_STATUS.CHANGES_REQUESTED]: 'Changes requested',
  [CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES]: 'Ready for review with new changes',
  [CERT_RUN_STATUS.APPROVED]: 'Approved',
  [CERT_RUN_STATUS.REJECTED]: 'Rejected',
};

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

/** The statuses a run waits in for a reviewer to pick it up. */
export const CERT_REVIEW_QUEUE_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.READY_FOR_REVIEW,
  CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
];

/** The status Send to Review moves a run to, or null when it can't be sent from `from`. */
export const sendToReviewStatus = (from: CertRunStatus): CertRunStatus | null =>
  CERT_RUN_TRANSITIONS[from].find((to) => CERT_REVIEW_QUEUE_STATUSES.includes(to)) ?? null;

/** Why a run can't be sent to review yet; the API's refusal and the Scenarios page's note. */
export const CERT_NOT_ALL_SCENARIOS_COMPLETED =
  'Every scenario must succeed before the run can be sent to review.';

/** A data store's open run, as the Certification pages need it. */
export class CertificationRunSummaryDto {
  @Expose()
  runId: number;

  @Expose()
  status: CertRunStatus;

  @Expose()
  canExecuteSteps: boolean;
}

/** Why a run can't be started: the data store already has an open run of the model. */
export const certRunAlreadyOpenMessage = (certificationModel: CertModel): string =>
  `A ${certificationModel} run is already open for this data store.`;

/** The Certification Models a vendor can start a run for. Others appear when their stories are done. */
export const SUPPORTED_CERT_MODELS: readonly CertModel[] = [CERT_MODEL.sis];

/**
 * Body of POST .../certification/runs. The team and tenant come from the route, and the user
 * from the session, so the browser can only choose the data store and the model.
 */
export class PostCertificationRunDto {
  @Expose()
  @Type(() => Number)
  @IsInt()
  odsId: number;

  @Expose()
  @IsIn(Object.values(CERT_MODEL))
  certificationModel: CertModel;
}

/** One certification run, with what its Scenarios page needs to show and to call the API. */
export class CertificationRunDto {
  @Expose()
  runId: number;

  @Expose()
  sbEnvironmentId: number;

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
  certificationModel: CertModel;

  @Expose()
  status: CertRunStatus;

  @Expose()
  canExecuteSteps: boolean;

  /** The data standard of the run's catalog (e.g. `v5`); null for a model without a catalog. */
  @Expose()
  dataStandardVersion: string | null;
}

export const toCertificationRunDto = makeSerializer<CertificationRunDto, CertificationRunDto>(
  CertificationRunDto,
);

/** The newest run of one Certification Model on a data store; an open one blocks starting another. */
export class CertificationLatestRunDto {
  @Expose()
  certificationModel: CertModel;

  @Expose()
  runId: number;

  @Expose()
  status: CertRunStatus;

  @Expose()
  isOpen: boolean;
}

export const toCertificationLatestRunDto = makeSerializer<
  CertificationLatestRunDto,
  CertificationLatestRunDto
>(CertificationLatestRunDto);
