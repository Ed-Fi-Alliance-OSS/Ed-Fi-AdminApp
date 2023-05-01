import { Route } from '@tanstack/router';
import { asRoute, mainLayoutRoute } from '.';
import { AccountPage } from '../Pages/Account/AccountPage';

export const accountRouteGlobal = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: 'account',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Account', params }),
  }),
  component: AccountPage,
});
