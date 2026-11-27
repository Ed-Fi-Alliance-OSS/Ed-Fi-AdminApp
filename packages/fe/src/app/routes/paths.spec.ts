import { certificationReviewPath, certificationReviewStepsPath, routeDefinitions } from './paths';

jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));

describe('certification review paths', () => {
  it('fills in the run id', () => {
    expect(certificationReviewPath(7)).toBe('/certification/runs/7/review');
  });

  it('adds the domain filter to the review page address', () => {
    expect(certificationReviewPath(7, 'Student Enrollment')).toBe(
      '/certification/runs/7/review?domain=Student%20Enrollment',
    );
    expect(certificationReviewPath(7, '')).toBe('/certification/runs/7/review');
  });

  it('carries the domain filter in the steps page address', () => {
    expect(certificationReviewStepsPath(7, 52, 'Student Enrollment')).toBe(
      '/certification/runs/7/review/steps?scenarioId=52&domain=Student%20Enrollment',
    );
  });

  it('puts the scenario of the steps page in the query string', () => {
    expect(certificationReviewStepsPath(7, 52)).toBe(
      '/certification/runs/7/review/steps?scenarioId=52',
    );
  });
});

describe('certification review queue path', () => {
  it('lives under /certification/queue', () => {
    expect(routeDefinitions.certificationQueue.index).toBe('/certification/queue');
  });
});
