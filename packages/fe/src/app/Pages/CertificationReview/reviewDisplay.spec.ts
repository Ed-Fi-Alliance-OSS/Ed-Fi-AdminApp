import 'reflect-metadata';
import { CertificationReviewScenarioDto, CertificationReviewStepDto } from '@edanalytics/models';
import {
  SCENARIO_STATUS_DISPLAY,
  STEP_STATUS_DISPLAY,
} from '../CertificationV2/certificationStepResults';
import {
  countPassedSteps,
  REVIEW_SCENARIO_STATUS_DISPLAY,
  REVIEW_STEP_STATUS_DISPLAY,
  reviewDomainNames,
} from './reviewDisplay';

const step = (stepId: number, status: 'success' | 'failed' | null): CertificationReviewStepDto =>
  ({
    stepId,
    name: `Step ${stepId}`,
    result: status
      ? {
          stepId,
          status,
          ranAt: '2026-11-11T09:00:00.000Z',
          inputs: {},
          responseStatus: 200,
          errors: [],
        }
      : null,
  }) as CertificationReviewStepDto;

const scenario = (scenarioId: number, domainName: string) =>
  ({
    scenarioId,
    domainName,
    name: `Scenario ${scenarioId}`,
    status: null,
    steps: [],
  }) as CertificationReviewScenarioDto;

describe('review status labels', () => {
  it('says Passed for a passed scenario and step', () => {
    expect(REVIEW_SCENARIO_STATUS_DISPLAY.success.label).toBe('Passed');
    expect(REVIEW_STEP_STATUS_DISPLAY.success.label).toBe('Passed');
  });

  it('keeps the vendor colours and the other labels', () => {
    expect(REVIEW_SCENARIO_STATUS_DISPLAY.success.dotColor).toBe(
      SCENARIO_STATUS_DISPLAY.success.dotColor,
    );
    expect(REVIEW_STEP_STATUS_DISPLAY.failed).toEqual(STEP_STATUS_DISPLAY.failed);
    expect(REVIEW_STEP_STATUS_DISPLAY.notExecuted.label).toBe('Not executed');
    expect(REVIEW_SCENARIO_STATUS_DISPLAY.inProgress).toEqual(SCENARIO_STATUS_DISPLAY.inProgress);
  });

  it('leaves the vendor label as Successful', () => {
    expect(STEP_STATUS_DISPLAY.success.label).toBe('Successful');
    expect(SCENARIO_STATUS_DISPLAY.success.label).toBe('Successful');
  });
});

describe('countPassedSteps', () => {
  it('counts the passed steps out of the steps shown', () => {
    expect(
      countPassedSteps([step(1, 'success'), step(2, 'failed'), step(3, null), step(4, 'success')]),
    ).toEqual({
      passed: 2,
      total: 4,
    });
  });

  it('is 0 of 0 for a scenario without steps', () => {
    expect(countPassedSteps([])).toEqual({ passed: 0, total: 0 });
  });
});

describe('reviewDomainNames', () => {
  it('lists each domain once, in the order the scenarios come', () => {
    expect(
      reviewDomainNames([
        scenario(1, 'Enrollment'),
        scenario(2, 'Staff'),
        scenario(3, 'Enrollment'),
        scenario(4, 'Assessment'),
      ]),
    ).toEqual(['Enrollment', 'Staff', 'Assessment']);
  });
});
