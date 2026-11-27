import { CERT_REVIEW_QUEUE_STATUSES, CERT_RUN_STATUS, CertRunStatus } from '@edanalytics/models';

const DISABLED_REASONS: Partial<Record<CertRunStatus, string>> = {
  [CERT_RUN_STATUS.IN_REVIEW]: 'Already picked up',
  [CERT_RUN_STATUS.DRAFT]: 'The vendor is still working on this run',
  [CERT_RUN_STATUS.CHANGES_REQUESTED]: 'The vendor is still working on this run',
  [CERT_RUN_STATUS.APPROVED]: 'Already decided',
  [CERT_RUN_STATUS.REJECTED]: 'Already decided',
};

/** Why Pick up is unavailable for a run, or null when the reviewer can pick it up. */
export const pickUpDisabledReason = (status: CertRunStatus, canReview: boolean): string | null => {
  if (!canReview) return 'You need review permission';
  return CERT_REVIEW_QUEUE_STATUSES.includes(status) ? null : (DISABLED_REASONS[status] ?? null);
};
