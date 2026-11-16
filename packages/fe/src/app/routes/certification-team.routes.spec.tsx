import type { RouteObject } from 'react-router';
import { CertificationLayout } from '../Pages/CertificationV2/CertificationAuthContext';
import { CertificationPageExecution } from '../Pages/CertificationV2/CertificationPageExecution';
import { CertificationScenariosPage } from '../Pages/CertificationV2/CertificationScenariosPage';
import { MyProductsPage } from '../Pages/MyProducts/MyProductsPage';
import { certificationTeamRoutes } from './certification-team.routes';

jest.mock('../Pages/MyProducts/MyProductsPage', () => ({ MyProductsPage: () => null }));
jest.mock('../Pages/CertificationV2/CertificationAuthContext', () => ({
  CertificationLayout: () => null,
}));
jest.mock('../Pages/CertificationV2/CertificationPageExecution', () => ({
  CertificationPageExecution: () => null,
}));
jest.mock('../Pages/CertificationV2/CertificationScenariosPage', () => ({
  CertificationScenariosPage: () => null,
}));
// paths.ts only needs useNavContext from the helpers barrel, which pulls in ESM-only modules.
jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));

describe('certificationTeamRoutes', () => {
  const [layoutRoute] = certificationTeamRoutes;
  const [myProductsRoute, scenariosRoute, executionRoute] = layoutRoute.children as RouteObject[];

  it('is one pathless layout, so the token survives going from the popup to the run pages', () => {
    expect(certificationTeamRoutes).toHaveLength(1);
    expect(layoutRoute.path).toBeUndefined();
    expect(layoutRoute.element).toMatchObject({ type: CertificationLayout });
    expect(layoutRoute.children).toHaveLength(3);
  });

  it('serves My products at /as/:asId/my-products', () => {
    expect(myProductsRoute.path).toBe('/as/:asId/my-products');
    expect(myProductsRoute.element).toMatchObject({ type: MyProductsPage });
    expect(myProductsRoute.handle.crumb()).toBe('My products');
  });

  it("serves a run's Scenarios page at /as/:asId/certification/runs/:runId", () => {
    expect(scenariosRoute.path).toBe('/as/:asId/certification/runs/:runId');
    expect(scenariosRoute.element).toMatchObject({ type: CertificationScenariosPage });
    expect(scenariosRoute.handle.crumb()).toBe('Scenarios');
  });

  it("serves a run's steps page under its Scenarios page", () => {
    expect(executionRoute.path).toBe('/as/:asId/certification/runs/:runId/execution');
    expect(executionRoute.element).toMatchObject({ type: CertificationPageExecution });
    expect(executionRoute.handle.crumb()).toBe('Steps');
  });

  it('has no certification page outside a team', () => {
    const paths = (layoutRoute.children as RouteObject[]).map((route) => route.path);
    expect(paths.every((path) => path?.startsWith('/as/:asId/'))).toBe(true);
  });
});
