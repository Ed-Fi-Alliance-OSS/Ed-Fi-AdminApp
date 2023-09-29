import { Box, ListItem, Text, UnorderedList } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { Outlet, RouteObject, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ErrorFallback } from '../Layout/Fallback404';
import { PublicAppLayout } from '../Layout/PublicAppLayout';
import { StandardLayout } from '../Layout/StandardLayout';
import { TenantHome } from '../Pages/Home/TenantHome';
import { useSearchParamsObject } from '../helpers/useSearch';
import { accountRouteGlobal } from './account.routes';
import {
  applicationCreateRoute,
  applicationIndexRoute,
  applicationRoute,
  applicationsIndexRoute,
  applicationsRoute,
} from './application.routes';
import {
  claimsetIndexRoute,
  claimsetRoute,
  claimsetsIndexRoute,
  claimsetsRoute,
} from './claimset.routes';
import { edorgIndexRoute, edorgRoute, edorgsIndexRoute, edorgsRoute } from './edorg.routes';
import { odsIndexRoute, odsRoute, odssIndexRoute, odssRoute } from './ods.routes';
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
import {
  roleGlobalCreateRoute,
  roleGlobalIndexRoute,
  roleGlobalRoute,
  rolesGlobalIndexRoute,
  rolesGlobalRoute,
} from './role-global.routes';
import { roleIndexRoute, roleRoute, rolesIndexRoute, rolesRoute } from './role.routes';
import {
  sbeGlobalCreateRoute,
  sbeGlobalIndexRoute,
  sbeGlobalRoute,
  sbesGlobalIndexRoute,
  sbesGlobalRoute,
} from './sbe-global.routes';
import { sbeIndexRoute, sbeRoute, sbesIndexRoute, sbesRoute } from './sbe.routes';
import { secretRoute } from './secret.routes';
import {
  tenantCreateRoute,
  tenantIndexRoute,
  tenantRoute,
  tenantsIndexRoute,
  tenantsRoute,
} from './tenant.routes';
import { userIndexRoute, userRoute, usersIndexRoute, usersRoute } from './user.routes';
import {
  vendorIndexRoute,
  vendorCreateRoute,
  vendorRoute,
  vendorsIndexRoute,
  vendorsRoute,
} from './vendor.routes';
import {
  usersGlobalRoute,
  usersGlobalIndexRoute,
  userGlobalRoute,
  userGlobalIndexRoute,
  userGlobalCreateRoute,
} from './user-global.routes';
import { GlobalHome } from '../Pages/Home/GlobalHome';
import { UnauthenticatedPage } from '../Layout/Unauthenticated';
import { useMe } from '../api';
import { LandingLayoutRouteElement } from '../Layout/LandingLayout';
import {
  utmsGlobalRoute,
  utmsGlobalIndexRoute,
  utmGlobalRoute,
  utmGlobalIndexRoute,
  utmGlobalCreateRoute,
} from './utm-global.routes';
import {
  sbSyncQueuesRoute,
  sbSyncQueuesIndexRoute,
  sbSyncQueueRoute,
  sbSyncQueueIndexRoute,
} from './sb-sync-queue.routes';
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
export * from './utm-global.routes';
export * from './user.routes';
export * from './user-global.routes';
export * from './vendor.routes';
export * from './sb-sync-queue.routes';

export const fallback404Route: RouteObject = {
  path: '*',
  element: <ErrorFallback />,
};

export const indexRoute: RouteObject = {
  path: '/',
  element: <GlobalHome />,
};
export const unauthenticatedRoute: RouteObject = {
  path: '/unauthenticated',
  element: <UnauthenticatedPage />,
};
const Login = memo(() => {
  const { redirect } = useSearchParamsObject() as any;
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
  element: <TenantHome />,
};

export const landingLayoutRoute: RouteObject = {
  element: <LandingLayoutRouteElement />,
  errorElement: <ErrorFallback />,
  children: [unauthenticatedRoute],
};
export const publicLayoutRoute: RouteObject = {
  element: <PublicAppLayout />,
  errorElement: <ErrorFallback />,
  children: [landingLayoutRoute, secretRoute],
};

const AuthenticatedRoute = () => {
  const me = useMe();
  if (me.isLoading || me.data === undefined) {
    return null;
  } else if (me.data === null) {
    window.location.href = `${window.location.origin}/login?redirect=${encodeURIComponent(
      window.location.href.replace(window.location.origin, '')
    )}`;
    return null;
  }
  return <Outlet />;
};

export const authenticatedRoutes: RouteObject = {
  element: <AuthenticatedRoute />,
  errorElement: <ErrorFallback />,
  children: [
    sbSyncQueuesRoute,
    sbSyncQueuesIndexRoute,
    sbSyncQueueRoute,
    sbSyncQueueIndexRoute,

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

    usersGlobalRoute,
    usersGlobalIndexRoute,
    userGlobalCreateRoute,
    userGlobalRoute,
    userGlobalIndexRoute,

    ownershipsGlobalRoute,
    ownershipsGlobalIndexRoute,
    ownershipGlobalRoute,
    ownershipGlobalIndexRoute,
    ownershipGlobalCreateRoute,

    utmsGlobalRoute,
    utmsGlobalIndexRoute,
    utmGlobalRoute,
    utmGlobalIndexRoute,
    utmGlobalCreateRoute,

    sbesRoute,
    sbesIndexRoute,
    sbeRoute,
    sbeIndexRoute,

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
    vendorCreateRoute,

    asRoute,
    accountRouteGlobal,
  ],
};

export const mainLayoutRoute: RouteObject = {
  element: <StandardLayout />,
  errorElement: <ErrorFallback />,
  handle: { crumb: () => 'Home' },
  children: [indexRoute, authenticatedRoutes],
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
