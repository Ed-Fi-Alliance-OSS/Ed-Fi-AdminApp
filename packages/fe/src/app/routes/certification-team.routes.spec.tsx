import { MyProductsPage } from '../Pages/MyProducts/MyProductsPage';
import { certificationTeamRoutes } from './certification-team.routes';

jest.mock('../Pages/MyProducts/MyProductsPage', () => ({ MyProductsPage: () => null }));
// paths.ts only needs useNavContext from the helpers barrel, which pulls in ESM-only modules.
jest.mock('../helpers', () => ({ useNavContext: jest.fn() }));

describe('certificationTeamRoutes', () => {
  const [myProductsRoute] = certificationTeamRoutes;

  it('has only the My products route', () => {
    expect(certificationTeamRoutes).toHaveLength(1);
  });

  it('serves My products at /as/:asId/my-products', () => {
    expect(myProductsRoute.path).toBe('/as/:asId/my-products');
  });

  it('renders MyProductsPage', () => {
    expect(myProductsRoute.element).toMatchObject({ type: MyProductsPage });
  });

  it('labels the breadcrumb "My products"', () => {
    expect(myProductsRoute.handle.crumb()).toBe('My products');
  });
});
