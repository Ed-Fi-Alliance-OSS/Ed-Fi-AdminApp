import { CERT_RUN_STATUS, CertRunStatus } from '@edanalytics/models';

/** Chakra color scheme of each run status. A Record, so a new status fails to compile until it has a color. */
export const CERT_RUN_STATUS_COLOR_SCHEMES: Record<CertRunStatus, string> = {
  [CERT_RUN_STATUS.DRAFT]: 'gray',
  [CERT_RUN_STATUS.READY_FOR_REVIEW]: 'blue',
  [CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES]: 'cyan',
  [CERT_RUN_STATUS.IN_REVIEW]: 'purple',
  [CERT_RUN_STATUS.CHANGES_REQUESTED]: 'orange',
  [CERT_RUN_STATUS.APPROVED]: 'green',
  [CERT_RUN_STATUS.REJECTED]: 'red',
};

export const certRunStatusColor = (status: CertRunStatus): string =>
  CERT_RUN_STATUS_COLOR_SCHEMES[status];
