import { Expose, Type } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
import { CERT_RUN_STATUS, canTransitionRun } from './certification-run.dto';
import type { CertRunStatus } from './certification-run.dto';

/** What happened to a run, one entry of its append-only history. */
export const CERT_RUN_EVENT = {
  CREATED: 'CREATED',
  SUBMITTED: 'SUBMITTED',
  RESUBMITTED: 'RESUBMITTED',
  PICKED_UP: 'PICKED_UP',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type CertRunEvent = (typeof CERT_RUN_EVENT)[keyof typeof CERT_RUN_EVENT];

/** How each event reads in the UI. Keep next to CERT_RUN_EVENT so a rename or removal fails to compile here. */
export const CERT_RUN_EVENT_LABELS: Record<CertRunEvent, string> = {
  [CERT_RUN_EVENT.CREATED]: 'Run started',
  [CERT_RUN_EVENT.SUBMITTED]: 'Sent to review',
  [CERT_RUN_EVENT.RESUBMITTED]: 'Sent to review again',
  [CERT_RUN_EVENT.PICKED_UP]: 'Picked up for review',
  [CERT_RUN_EVENT.CHANGES_REQUESTED]: 'Changes requested',
  [CERT_RUN_EVENT.APPROVED]: 'Approved',
  [CERT_RUN_EVENT.REJECTED]: 'Rejected',
};

/** The event a status change records; throws when the change is not an allowed transition. */
export const certRunEventFor = (from: CertRunStatus, to: CertRunStatus): CertRunEvent => {
  if (!canTransitionRun(from, to)) {
    throw new Error(`Run cannot move from ${from} to ${to}.`);
  }
  switch (to) {
    case CERT_RUN_STATUS.IN_REVIEW:
      return CERT_RUN_EVENT.PICKED_UP;
    case CERT_RUN_STATUS.READY_FOR_REVIEW:
      return CERT_RUN_EVENT.SUBMITTED;
    case CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES:
      return CERT_RUN_EVENT.RESUBMITTED;
    case CERT_RUN_STATUS.CHANGES_REQUESTED:
      return CERT_RUN_EVENT.CHANGES_REQUESTED;
    case CERT_RUN_STATUS.APPROVED:
      return CERT_RUN_EVENT.APPROVED;
    case CERT_RUN_STATUS.REJECTED:
      return CERT_RUN_EVENT.REJECTED;
    default:
      throw new Error(`No event for a move to ${to}.`);
  }
};

/** Shown as the actor of an event the system itself made. */
export const CERT_SYSTEM_ACTOR_NAME = 'System';

/** Shown as the actor when the user behind an event no longer exists. */
export const CERT_FORMER_USER_NAME = 'Former user';

export class CertificationRunEventDto {
  @Expose()
  eventId: number;

  @Expose()
  event: CertRunEvent;

  /** The status before the event; null for the run's creation. */
  @Expose()
  fromStatus: CertRunStatus | null;

  @Expose()
  toStatus: CertRunStatus;

  /** ISO string of when the event happened. */
  @Expose()
  createdAt: string;

  @Expose()
  actorName: string;

  /** The reviewer's comment, when the event carried one. */
  @Expose()
  comment: string | null;
}

export const toCertificationRunEventDto = makeSerializer<
  CertificationRunEventDto,
  CertificationRunEventDto
>(CertificationRunEventDto);

export const CERT_RUN_EVENTS_DEFAULT_LIMIT = 50;
export const CERT_RUN_EVENTS_MAX_LIMIT = 200;

export class CertificationRunEventPageDto {
  @Expose()
  @Type(() => CertificationRunEventDto)
  items: CertificationRunEventDto[];

  /** How many events the run has in all, not just in this page. */
  @Expose()
  total: number;
}

export const toCertificationRunEventPageDto = makeSerializer<
  CertificationRunEventPageDto,
  CertificationRunEventPageDto
>(CertificationRunEventPageDto);
