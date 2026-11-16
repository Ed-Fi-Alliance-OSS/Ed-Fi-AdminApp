import { CERT_SCENARIO_STATUS, CertRunStatus, CertScenarioStatus } from '@edanalytics/models';

/** How a run's workflow status reads on the Scenarios page (AC-659). */
export const CERT_RUN_STATUS_LABEL: Record<CertRunStatus, string> = {
  DRAFT: 'Draft',
  READY_FOR_REVIEW: 'Ready for review',
  IN_REVIEW: 'In review',
  CHANGES_REQUESTED: 'Changes requested',
  READY_FOR_REVIEW_WITH_CHANGES: 'Ready for review with new changes',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/** The Chakra color scheme of each status badge. */
export const CERT_RUN_STATUS_COLOR: Record<CertRunStatus, string> = {
  DRAFT: 'gray',
  READY_FOR_REVIEW: 'blue',
  IN_REVIEW: 'purple',
  CHANGES_REQUESTED: 'orange',
  READY_FOR_REVIEW_WITH_CHANGES: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
};

/**
 * How many of the given scenarios have succeeded. `scenarioIds` is every scenario of the run's
 * catalog (not just a filtered view), the same set the API checks before sending to review.
 */
export const countSuccessfulScenarios = (
  scenarioIds: number[],
  statusByScenarioId: Partial<Record<number, CertScenarioStatus>>,
): { successful: number; total: number } => ({
  successful: scenarioIds.filter(
    (scenarioId) => statusByScenarioId[scenarioId] === CERT_SCENARIO_STATUS.completed,
  ).length,
  total: scenarioIds.length,
});
