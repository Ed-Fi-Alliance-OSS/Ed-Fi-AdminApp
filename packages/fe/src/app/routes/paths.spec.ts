import { certificationReviewPath, certificationReviewStepsPath } from './paths';

jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));

describe('certification review paths', () => {
  it('fills in the run id', () => {
    expect(certificationReviewPath(7)).toBe('/certification/runs/7/review');
  });

  it('puts the scenario of the steps page in the query string', () => {
    expect(certificationReviewStepsPath(7, 52)).toBe(
      '/certification/runs/7/review/steps?scenarioId=52',
    );
  });
});
