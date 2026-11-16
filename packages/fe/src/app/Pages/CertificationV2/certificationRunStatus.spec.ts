import 'reflect-metadata';
import {
  CERT_RUN_STATUS_COLOR,
  CERT_RUN_STATUS_LABEL,
  countSuccessfulScenarios,
} from './certificationRunStatus';

describe('CERT_RUN_STATUS_LABEL', () => {
  it.each([
    ['DRAFT', 'Draft'],
    ['READY_FOR_REVIEW', 'Ready for review'],
    ['IN_REVIEW', 'In review'],
    ['CHANGES_REQUESTED', 'Changes requested'],
    ['READY_FOR_REVIEW_WITH_CHANGES', 'Ready for review with new changes'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
  ] as const)('shows %s as "%s"', (status, label) => {
    expect(CERT_RUN_STATUS_LABEL[status]).toBe(label);
    expect(CERT_RUN_STATUS_COLOR[status]).toEqual(expect.any(String));
  });
});

describe('countSuccessfulScenarios', () => {
  it('counts completed scenarios among the given ones', () => {
    expect(
      countSuccessfulScenarios([1, 2, 3, 4], { 1: 'completed', 2: 'failed', 3: 'inprogress' }),
    ).toEqual({ successful: 1, total: 4 });
  });

  it("ignores results of scenarios that aren't listed", () => {
    expect(countSuccessfulScenarios([1], { 1: 'completed', 9: 'completed' })).toEqual({
      successful: 1,
      total: 1,
    });
  });

  it('is 0 of 0 with no scenarios', () => {
    expect(countSuccessfulScenarios([], {})).toEqual({ successful: 0, total: 0 });
  });
});
