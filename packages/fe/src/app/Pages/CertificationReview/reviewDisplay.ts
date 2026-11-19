import { CertificationReviewScenarioDto, CertificationReviewStepDto } from '@edanalytics/models';
import {
  SCENARIO_STATUS_DISPLAY,
  ScenarioDisplayStatus,
  STEP_STATUS_DISPLAY,
  StatusDisplay,
  StepDisplayStatus,
} from '../CertificationV2/certificationStepResults';

/** The title of both review pages. */
export const REVIEW_PAGE_TITLE = 'Review certification run';

const PASSED = 'Passed';

/** Scenario statuses as the review pages show them: the vendor's, with "Passed" for a pass. */
export const REVIEW_SCENARIO_STATUS_DISPLAY: Record<ScenarioDisplayStatus, StatusDisplay> = {
  ...SCENARIO_STATUS_DISPLAY,
  success: { ...SCENARIO_STATUS_DISPLAY.success, label: PASSED },
};

/** Step statuses as the review pages show them: the vendor's, with "Passed" for a pass. */
export const REVIEW_STEP_STATUS_DISPLAY: Record<StepDisplayStatus, StatusDisplay> = {
  ...STEP_STATUS_DISPLAY,
  success: { ...STEP_STATUS_DISPLAY.success, label: PASSED },
};

/** "Tasks verified": the passed steps out of the steps shown for a scenario. */
export const countPassedSteps = (
  steps: CertificationReviewStepDto[],
): { passed: number; total: number } => ({
  passed: steps.filter((step) => step.result?.status === 'success').length,
  total: steps.length,
});

/** Each domain once, in the order the scenarios come (the catalog's order). */
export const reviewDomainNames = (scenarios: CertificationReviewScenarioDto[]): string[] => [
  ...new Set(scenarios.map((scenario) => scenario.domainName)),
];
