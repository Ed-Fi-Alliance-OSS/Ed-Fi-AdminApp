import { config } from '../../config/config';
import { CertificationDashboardPage } from '../Pages/CertificationDashboard/CertificationDashboardPage';
import { getCertificationDashboardRoutes } from './certification-dashboard.routes';

jest.mock('../Pages/CertificationDashboard/CertificationDashboardPage', () => ({
  CertificationDashboardPage: () => null,
}));
// paths.ts only needs useNavContext from the helpers barrel, which pulls in ESM-only modules.
jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));
jest.mock('../../config/config', () => ({ config: { showRequestCertification: false } }));

describe('getCertificationDashboardRoutes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registers /certification/dashboard when the flag is on', () => {
    jest.replaceProperty(config, 'showRequestCertification', true);

    const routes = getCertificationDashboardRoutes();

    expect(routes).toHaveLength(1);
    const [route] = routes;
    expect(route.path).toBe('/certification/dashboard');
    expect(route.element).toMatchObject({ type: CertificationDashboardPage });
    expect((route.handle as { crumb: () => string }).crumb()).toBe('Certification dashboard');
  });

  it('registers nothing when the flag is off', () => {
    jest.replaceProperty(config, 'showRequestCertification', false);
    expect(getCertificationDashboardRoutes()).toEqual([]);
  });
});
