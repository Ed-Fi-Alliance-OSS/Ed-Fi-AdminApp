import { config } from '../../config/config';
import { CertificationDashboardPage } from '../Pages/CertificationDashboard/CertificationDashboardPage';
import { CertificationQueuePage } from '../Pages/CertificationQueue/CertificationQueuePage';
import { CertificationReviewPage } from '../Pages/CertificationReview/CertificationReviewPage';
import { CertificationReviewStepsPage } from '../Pages/CertificationReview/CertificationReviewStepsPage';
import { getCertificationDashboardRoutes } from './certification-dashboard.routes';

jest.mock('../Pages/CertificationDashboard/CertificationDashboardPage', () => ({
  CertificationDashboardPage: () => null,
}));
jest.mock('../Pages/CertificationQueue/CertificationQueuePage', () => ({
  CertificationQueuePage: () => null,
}));
jest.mock('../Pages/CertificationReview/CertificationReviewPage', () => ({
  CertificationReviewPage: () => null,
}));
jest.mock('../Pages/CertificationReview/CertificationReviewStepsPage', () => ({
  CertificationReviewStepsPage: () => null,
}));
// paths.ts only needs useNavContext from the helpers barrel, which pulls in ESM-only modules.
jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));
jest.mock('../../config/config', () => ({ config: { showRequestCertification: false } }));

describe('getCertificationDashboardRoutes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registers /certification/dashboard when the flag is on', () => {
    jest.replaceProperty(config, 'showRequestCertification', true);

    const route = getCertificationDashboardRoutes().find(
      (r) => r.path === '/certification/dashboard',
    );

    expect(route).toBeDefined();
    expect(route?.element).toMatchObject({ type: CertificationDashboardPage });
    expect((route?.handle as { crumb: () => string }).crumb()).toBe('Certification dashboard');
  });

  it('registers /certification/queue when the flag is on', () => {
    jest.replaceProperty(config, 'showRequestCertification', true);

    const route = getCertificationDashboardRoutes().find((r) => r.path === '/certification/queue');

    expect(route).toBeDefined();
    expect(route?.element).toMatchObject({ type: CertificationQueuePage });
    expect((route?.handle as { crumb: () => string }).crumb()).toBe('Review queue');
  });

  it('registers the review page when the flag is on', () => {
    jest.replaceProperty(config, 'showRequestCertification', true);

    const route = getCertificationDashboardRoutes().find(
      (r) => r.path === '/certification/runs/:runId/review',
    );

    expect(route).toBeDefined();
    expect(route?.element).toMatchObject({ type: CertificationReviewPage });
    expect((route?.handle as { crumb: () => string }).crumb()).toBe('Review');
  });

  it('registers the review steps page when the flag is on', () => {
    jest.replaceProperty(config, 'showRequestCertification', true);

    const route = getCertificationDashboardRoutes().find(
      (r) => r.path === '/certification/runs/:runId/review/steps',
    );

    expect(route).toBeDefined();
    expect(route?.element).toMatchObject({ type: CertificationReviewStepsPage });
    expect((route?.handle as { crumb: () => string }).crumb()).toBe('Steps');
  });

  it('registers nothing when the flag is off', () => {
    jest.replaceProperty(config, 'showRequestCertification', false);
    expect(getCertificationDashboardRoutes()).toEqual([]);
  });
});
