import { certificationReviewPath } from './paths';

jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));

describe('certification review paths', () => {
  it('fills in the run id', () => {
    expect(certificationReviewPath(7)).toBe('/certification/runs/7/review');
  });
});
