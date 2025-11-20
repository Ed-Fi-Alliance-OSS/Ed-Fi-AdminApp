import { RouteObject } from 'react-router';
import { AccountPage } from '../Pages/Account/AccountPage';

export const accountRouteGlobal: RouteObject = {
  path: '/account',
  handle: { crumb: () => 'Account' },
  element: <AccountPage />,
};
