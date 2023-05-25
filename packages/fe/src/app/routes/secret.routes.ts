import { Route } from '@tanstack/router';
import { publicAppLayoutRoute } from '.';
import { SecretPage } from '../Pages/Secret/SecretPage';

export const secretRoute = new Route({
  getParentRoute: () => publicAppLayoutRoute,
  path: 'secret/$uuid/$key',
  component: SecretPage,
});
