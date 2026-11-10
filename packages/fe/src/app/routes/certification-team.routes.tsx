import { RouteObject } from 'react-router';
import { MyProductsPage } from '../Pages/MyProducts/MyProductsPage';
import { routeDefinitions } from './paths';

const myProductsRoute: RouteObject = {
  path: routeDefinitions.asTeam.myProducts.index,
  element: <MyProductsPage />,
  handle: { crumb: () => 'My products' },
};

export const certificationTeamRoutes = [myProductsRoute];
