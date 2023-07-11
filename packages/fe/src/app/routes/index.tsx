import { Heading } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { RouteObject, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ErrorFallback } from '../Layout/Fallback404';
import { StandardLayout } from '../Layout/StandardLayout';
import { useSearchParamsObject } from '../helpers/useSearch';
import { accountRouteGlobal } from './account.routes';
import {
  ownershipGlobalCreateRoute,
  ownershipGlobalIndexRoute,
  ownershipGlobalRoute,
  ownershipsGlobalIndexRoute,
  ownershipsGlobalRoute,
} from './ownership-global.routes';
import {
  ownershipIndexRoute,
  ownershipRoute,
  ownershipsIndexRoute,
  ownershipsRoute,
} from './ownership.routes';
import { roleIndexRoute, roleRoute, rolesIndexRoute, rolesRoute } from './role.routes';
import {
  sbeGlobalCreateRoute,
  sbeGlobalIndexRoute,
  sbeGlobalRoute,
  sbesGlobalIndexRoute,
  sbesGlobalRoute,
} from './sbe-global.routes';
import { sbeIndexRoute, sbeRoute, sbesIndexRoute, sbesRoute } from './sbe.routes';
import {
  tenantCreateRoute,
  tenantIndexRoute,
  tenantRoute,
  tenantsIndexRoute,
  tenantsRoute,
} from './tenant.routes';
import { userIndexRoute, userRoute, usersIndexRoute, usersRoute } from './user.routes';
import {
  claimsetsRoute,
  claimsetsIndexRoute,
  claimsetRoute,
  claimsetIndexRoute,
} from './claimset.routes';
import { edorgsRoute, edorgsIndexRoute, edorgRoute, edorgIndexRoute } from './edorg.routes';
import { odssRoute, odssIndexRoute, odsRoute, odsIndexRoute } from './ods.routes';
import { vendorsRoute, vendorsIndexRoute, vendorRoute, vendorIndexRoute } from './vendor.routes';
import {
  applicationCreateRoute,
  applicationIndexRoute,
  applicationRoute,
  applicationsIndexRoute,
  applicationsRoute,
} from './application.routes';
import { secretRoute } from './secret.routes';
import { PublicAppLayout } from '../Layout/PublicAppLayout';
import {
  rolesGlobalRoute,
  rolesGlobalIndexRoute,
  roleGlobalRoute,
  roleGlobalIndexRoute,
  roleGlobalCreateRoute,
} from './role-global.routes';
export * from './account.routes';
export * from './application.routes';
export * from './claimset.routes';
export * from './edorg.routes';
export * from './ods.routes';
export * from './ownership-global.routes';
export * from './ownership.routes';
export * from './role.routes';
export * from './sbe-global.routes';
export * from './sbe.routes';
export * from './tenant.routes';
export * from './user.routes';
export * from './vendor.routes';

export const fallback404Route: RouteObject = {
  path: '*',
  element: <ErrorFallback />,
};
export const indexRoute: RouteObject = {
  path: '/',
  element: <Heading size="page-heading">Home</Heading>,
};
export const publicRoute: RouteObject = {
  path: '/public',
  element: <a href="/login">Login</a>,
};
export const noRoleRoute: RouteObject = {
  path: '/no-role',
  element: <>You have not been assigned a role.</>,
};
const Login = memo(() => {
  const { redirect } = useSearchParamsObject();
  useEffect(() => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oidc/1/login${
      redirect ? `?redirect=${redirect}` : ''
    }`;
  }, []);
  return null;
});
export const loginRoute: RouteObject = {
  path: '/login',
  element: <Login />,
  errorElement: <ErrorFallback />,
};
export const asRoute: RouteObject = {
  path: '/as/:asId',
};
export const publicLayoutRoute: RouteObject = {
  element: <PublicAppLayout />,
  errorElement: <ErrorFallback />,
  children: [publicRoute, secretRoute, noRoleRoute],
};
export const mainLayoutRoute: RouteObject = {
  element: <StandardLayout />,
  errorElement: <ErrorFallback />,
  handle: { crumb: () => 'Home' },
  children: [
    indexRoute,

    sbesGlobalRoute,
    sbesGlobalIndexRoute,
    sbeGlobalCreateRoute,
    sbeGlobalRoute,
    sbeGlobalIndexRoute,

    rolesGlobalRoute,
    rolesGlobalIndexRoute,
    roleGlobalCreateRoute,
    roleGlobalRoute,
    roleGlobalIndexRoute,

    ownershipsGlobalRoute,
    ownershipsGlobalIndexRoute,
    ownershipGlobalRoute,
    ownershipGlobalIndexRoute,
    ownershipGlobalCreateRoute,

    sbesRoute,
    sbesIndexRoute,
    sbeRoute,
    sbeIndexRoute,

    odssRoute,
    odssIndexRoute,
    odsRoute,
    odsIndexRoute,

    odssRoute,
    odssIndexRoute,
    odsRoute,
    odsIndexRoute,

    rolesRoute,
    rolesIndexRoute,
    roleRoute,
    roleIndexRoute,

    tenantsRoute,
    tenantsIndexRoute,
    tenantRoute,
    tenantIndexRoute,
    tenantCreateRoute,

    usersRoute,
    usersIndexRoute,
    userRoute,
    userIndexRoute,

    ownershipsRoute,
    ownershipsIndexRoute,
    ownershipRoute,
    ownershipIndexRoute,

    edorgsRoute,
    edorgsIndexRoute,
    edorgRoute,
    edorgIndexRoute,

    claimsetsRoute,
    claimsetsIndexRoute,
    claimsetRoute,
    claimsetIndexRoute,

    applicationsRoute,
    applicationsIndexRoute,
    applicationRoute,
    applicationIndexRoute,
    applicationCreateRoute,

    vendorsRoute,
    vendorsIndexRoute,
    vendorRoute,
    vendorIndexRoute,

    asRoute,
    accountRouteGlobal,
  ],
};
export const routes = [mainLayoutRoute, publicLayoutRoute, loginRoute, fallback404Route];
const addPathToHandle = (r: RouteObject) => {
  r.handle = {
    ...r.handle,
    path: r.path,
  };
  r.children?.forEach((route) => addPathToHandle(route));
};
routes.forEach(addPathToHandle);
const flattenRoute = (r: RouteObject): RouteObject[] =>
  [r, ...(r.children ?? []).map((route) => flattenRoute(route))].flat();
const router = createBrowserRouter(routes);
export const flatRoutes = routes.flatMap(flattenRoute);
export const Routes = () => {
  return <RouterProvider router={router} />;
};
