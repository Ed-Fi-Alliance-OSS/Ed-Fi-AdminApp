import {
  ownershipRoute,
  ownershipsRoute,
  ownershipsIndexRoute,
  ownershipIndexRoute,
} from './ownership.routes';
import {
  roleRoute,
  rolesRoute,
  rolesIndexRoute,
  roleIndexRoute,
} from './role.routes';
import {
  userTenantMembershipRoute,
  userTenantMembershipsRoute,
  userTenantMembershipsIndexRoute,
  userTenantMembershipIndexRoute,
} from './user-tenant-membership.routes';
import {
  edorgRoute,
  edorgsRoute,
  edorgsIndexRoute,
  edorgIndexRoute,
} from './edorg.routes';
import {
  sbeRoute,
  sbesRoute,
  sbesIndexRoute,
  sbeIndexRoute,
} from './sbe.routes';
import {
  odsRoute,
  odssRoute,
  odssIndexRoute,
  odsIndexRoute,
} from './ods.routes';
import {
  tenantRoute,
  tenantsRoute,
  tenantsIndexRoute,
  tenantIndexRoute,
} from './tenant.routes';
import { Heading } from '@chakra-ui/react';
import {
  RootRoute,
  Route,
  Router,
  RouterProvider,
  useNavigate,
  useSearch,
} from '@tanstack/router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import axios from 'axios';
import { memo, useEffect } from 'react';
import { environment } from '../../environments/environment.local';
import { StandardLayout } from '../Layout/StandardLayout';
import { accountRouteGlobal } from './account.routes';
import {
  userIndexRoute,
  userRoute,
  usersIndexRoute,
  usersRoute,
} from './user.routes';
import { Fallback404 } from '../Layout/Fallback404';
import { SuccessContent } from '../Layout/SuccessContent';
import { useQueryClient } from '@tanstack/react-query';
import { handleQueryError } from '../helpers';
import { TenantLayout } from '../Layout/TenantLayout';
export * from './ownership.routes';
export * from './role.routes';
export * from './user-tenant-membership.routes';
export * from './edorg.routes';
export * from './sbe.routes';
export * from './ods.routes';
export * from './tenant.routes';
export * from './account.routes';
export * from './user.routes';

export const rootRoute = new RootRoute();

// export const rootLayoutRoute = new Route({
//   getParentRoute: () => rootRoute,
//   id: 'root-layout',
//   component: StandardLayout,
// });

export const fallback404Route = new Route({
  getParentRoute: () => rootRoute,
  path: '404',
  component: Fallback404,
});

export const mainLayoutRoute = new Route({
  getParentRoute: () => rootRoute,
  id: 'main-layout',
  component: StandardLayout,
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Home', params }),
  }),
});

export const indexRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: '/',
  component: () => (
    <Heading mb={4} fontSize="lg">
      Home
    </Heading>
  ),
});

export const publicRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/public',
  component: () => <a href="/login">Login</a>,
});

const Login = memo(() => {
  const { redirect } = useSearch({ from: loginRoute.id });
  useEffect(() => {
    window.location.href = `http://localhost:3333/api/auth/oidc/login${
      redirect ? `?redirect=${redirect}` : ''
    }`;
  }, []);
  return null;
});

export const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: Login,
  validateSearch: (search): { redirect?: string } =>
    typeof search.redirect === 'string'
      ? { redirect: decodeURIComponent(search.redirect) }
      : {},
});

export const asRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: 'as/$asId',
});

const routeTree = rootRoute.addChildren([
  publicRoute,
  loginRoute,
  fallback404Route,
  mainLayoutRoute.addChildren([
    indexRoute,
    asRoute.addChildren([
      ownershipsRoute.addChildren([
        ownershipsIndexRoute,
        ownershipRoute.addChildren([ownershipIndexRoute]),
      ]),
      rolesRoute.addChildren([
        rolesIndexRoute,
        roleRoute.addChildren([roleIndexRoute]),
      ]),
      userTenantMembershipsRoute.addChildren([
        userTenantMembershipsIndexRoute,
        userTenantMembershipRoute.addChildren([userTenantMembershipIndexRoute]),
      ]),
      sbesRoute.addChildren([
        sbesIndexRoute,
        sbeRoute.addChildren([
          sbeIndexRoute,
          odssRoute.addChildren([
            odssIndexRoute,
            odsRoute.addChildren([odsIndexRoute]),
          ]),
          edorgsRoute.addChildren([
            edorgsIndexRoute,
            edorgRoute.addChildren([edorgIndexRoute]),
          ]),
        ]),
      ]),
      usersRoute.addChildren([
        usersIndexRoute,
        userRoute.addChildren([userIndexRoute]),
      ]),
    ]),
    accountRouteGlobal,
    tenantsRoute.addChildren([
      tenantsIndexRoute,
      tenantRoute.addChildren([tenantIndexRoute]),
    ]),
  ]),
]);

// Create the router using your route tree
export const router = new Router({ routeTree });

export const Routes = () => {
  return (
    <>
      <RouterProvider router={router} />
      {environment.production ? null : (
        <TanStackRouterDevtools position="bottom-right" router={router} />
      )}
    </>
  );
};
