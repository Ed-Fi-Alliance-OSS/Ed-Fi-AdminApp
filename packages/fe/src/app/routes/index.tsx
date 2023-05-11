import {
  claimsetRoute,
  claimsetsRoute,
  claimsetsIndexRoute,
  claimsetIndexRoute,
} from './claimset.routes';
import {
  applicationRoute,
  applicationsRoute,
  applicationsIndexRoute,
  applicationIndexRoute,
} from './application.routes';
import { Heading } from '@chakra-ui/react';
import {
  RootRoute,
  Route,
  Router,
  RouterProvider,
  useSearch,
} from '@tanstack/router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { memo, useEffect } from 'react';
import { environment } from '../../environments/environment.local';
import { ErrorFallback } from '../Layout/Fallback404';
import { StandardLayout } from '../Layout/StandardLayout';
import { accountRouteGlobal } from './account.routes';
import {
  edorgIndexRoute,
  edorgRoute,
  edorgsIndexRoute,
  edorgsRoute,
} from './edorg.routes';
import {
  odsIndexRoute,
  odsRoute,
  odssIndexRoute,
  odssRoute,
} from './ods.routes';
import {
  ownershipIndexRoute,
  ownershipRoute,
  ownershipsIndexRoute,
  ownershipsRoute,
} from './ownership.routes';
import {
  roleIndexRoute,
  roleRoute,
  rolesIndexRoute,
  rolesRoute,
} from './role.routes';
import {
  sbeIndexRoute,
  sbeRoute,
  sbesIndexRoute,
  sbesRoute,
} from './sbe.routes';
import {
  tenantIndexRoute,
  tenantRoute,
  tenantsIndexRoute,
  tenantsRoute,
} from './tenant.routes';
import {
  userTenantMembershipIndexRoute,
  userTenantMembershipRoute,
  userTenantMembershipsIndexRoute,
  userTenantMembershipsRoute,
} from './user-tenant-membership.routes';
import {
  userIndexRoute,
  userRoute,
  usersIndexRoute,
  usersRoute,
} from './user.routes';
import {
  vendorIndexRoute,
  vendorRoute,
  vendorsIndexRoute,
  vendorsRoute,
} from './vendor.routes';
export * from './claimset.routes';
export * from './application.routes';
export * from './account.routes';
export * from './edorg.routes';
export * from './ods.routes';
export * from './ownership.routes';
export * from './role.routes';
export * from './sbe.routes';
export * from './tenant.routes';
export * from './user-tenant-membership.routes';
export * from './user.routes';
export * from './vendor.routes';

export const rootRoute = new RootRoute();

export const fallback404Route = new Route({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <ErrorFallback message="404 - Not found." />,
});

export const mainLayoutRoute = new Route({
  errorComponent: (props: {
    error: { error: string; message: string; statusCode: number } | any;
  }) => (
    <ErrorFallback
      message={
        props.error?.statusCode
          ? `${props.error.statusCode} - ${props.error.message}.`
          : "Oops, there's been an error."
      }
    />
  ),
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
          vendorsRoute.addChildren([
            vendorsIndexRoute,
            vendorRoute.addChildren([vendorIndexRoute]),
          ]),
          applicationsRoute.addChildren([
            applicationsIndexRoute,
            applicationRoute.addChildren([applicationIndexRoute]),
          ]),
          claimsetsRoute.addChildren([
            claimsetsIndexRoute,
            claimsetRoute.addChildren([claimsetIndexRoute]),
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
  fallback404Route,
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
