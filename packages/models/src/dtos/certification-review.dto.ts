import { Expose, Transform, Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { makeSerializer } from '../utils/make-serializer';
import { CERT_RUN_STATUS } from './certification-run.dto';
import type { CertModel, CertRunStatus } from './certification-run.dto';
import { CertificationSavedStepRunDto } from './certification-step-run.dto';
import type { CertScenarioStatus } from './certification-step-run.dto';

/** Longest comment a reviewer can leave with a decision. */
export const CERT_REVIEW_COMMENT_MAX_LENGTH = 4000;

/** What a reviewer can decide about a run in review. */
export const CERT_REVIEW_DECISION = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
} as const;
export type CertReviewDecision = (typeof CERT_REVIEW_DECISION)[keyof typeof CERT_REVIEW_DECISION];

/** Rejecting or asking for changes must explain why; approving needs no comment. */
export const reviewDecisionNeedsComment = (decision: CertReviewDecision): boolean =>
  decision === CERT_REVIEW_DECISION.REJECTED || decision === CERT_REVIEW_DECISION.CHANGES_REQUESTED;

/** The statuses whose results a reviewer can read: the vendor has sent the run, or it is decided. */
export const CERT_REVIEW_READABLE_STATUSES: readonly CertRunStatus[] = [
  CERT_RUN_STATUS.READY_FOR_REVIEW,
  CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
  CERT_RUN_STATUS.IN_REVIEW,
  CERT_RUN_STATUS.APPROVED,
  CERT_RUN_STATUS.REJECTED,
];

export const isReviewReadable = (status: CertRunStatus): boolean =>
  CERT_REVIEW_READABLE_STATUSES.includes(status);

export const CERT_REVIEW_MESSAGES = {
  commentRequired: 'Write a comment before you confirm.',
} as const;

/** Body of the review decision endpoints. The comment is optional here; the API requires it per decision. */
export class PostCertificationReviewDecisionDto {
  @Expose()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(CERT_REVIEW_COMMENT_MAX_LENGTH)
  comment?: string;
}

/** The run a reviewer is reading. */
export class CertificationReviewRunDto {
  @Expose()
  runId: number;

  @Expose()
  teamName: string | null;

  @Expose()
  environmentName: string;

  @Expose()
  tenantName: string;

  @Expose()
  dataStoreName: string | null;

  @Expose()
  certificationModel: CertModel;

  @Expose()
  status: CertRunStatus;

  /** ISO string of when the vendor last sent the run to review; null if unknown. */
  @Expose()
  submittedAt: string | null;

  @Expose()
  dataStandardVersion: string | null;

  /** Whether this reviewer can start or decide the run right now. */
  @Expose()
  canDecide: boolean;
}

export class CertificationReviewStepDto {
  @Expose()
  stepId: number;

  @Expose()
  name: string;

  /** The last saved result; null when the step never ran. */
  @Expose()
  @Type(() => CertificationSavedStepRunDto)
  result: CertificationSavedStepRunDto | null;
}

export class CertificationReviewScenarioDto {
  @Expose()
  scenarioId: number;

  @Expose()
  domainName: string;

  @Expose()
  name: string;

  @Expose()
  status: CertScenarioStatus | null;

  @Expose()
  @Type(() => CertificationReviewStepDto)
  steps: CertificationReviewStepDto[];
}

export class CertificationReviewDto {
  @Expose()
  @Type(() => CertificationReviewRunDto)
  run: CertificationReviewRunDto;

  @Expose()
  @Type(() => CertificationReviewScenarioDto)
  scenarios: CertificationReviewScenarioDto[];
}

export const toCertificationReviewDto = makeSerializer<
  CertificationReviewDto,
  CertificationReviewDto
>(CertificationReviewDto);

/** A run's new status after a review action. */
export class CertificationReviewStatusDto {
  @Expose()
  runId: number;

  @Expose()
  status: CertRunStatus;
}

export const toCertificationReviewStatusDto = makeSerializer<
  CertificationReviewStatusDto,
  CertificationReviewStatusDto
>(CertificationReviewStatusDto);
