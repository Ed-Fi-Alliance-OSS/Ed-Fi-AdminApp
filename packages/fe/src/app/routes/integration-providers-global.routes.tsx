import { type RouteObject } from 'react-router-dom';
import { ManyIntegrationProvidersPage } from '../Pages/IntegrationProvider/ManyIntegrationProvidersPage';
import { CreateIntegrationProviderPage } from '../Pages/IntegrationProvider/CreateIntegrationProviderPage';
import { OneIntegrationProviderPage } from '../Pages/IntegrationProvider/OneIntegrationProviderPage';
import { IntegrationProviderBreadcrumb } from '../Pages/IntegrationProvider/IntegrationProviderBreadcrumb';

export const integrationProviderPaths = {
  index: '/integration-providers',
  create: '/integration-providers/create',
  id: (id: string | number) => `/integration-providers/${id}`,
  edit: (id: string | number) => `/integration-providers/${id}?edit=true`,
};

const integrationProvidersGlobalIndexRoute: RouteObject = {
  path: integrationProviderPaths.index,
  element: <ManyIntegrationProvidersPage />,
  handle: { crumb: () => 'Integration Providers' },
};

export const integrationProviderGlobalCreateRoute: RouteObject = {
  path: integrationProviderPaths.create,
  handle: { crumb: () => 'Create' },
  element: <CreateIntegrationProviderPage />,
};

export const integrationProviderGlobalViewRoute: RouteObject = {
  path: integrationProviderPaths.id(':integrationProviderId'),
  handle: { crumb: IntegrationProviderBreadcrumb },
  element: <OneIntegrationProviderPage />,
};

export const integrationProvidersGlobalRoutes = [
  integrationProvidersGlobalIndexRoute,
  integrationProviderGlobalCreateRoute,
  integrationProviderGlobalViewRoute,
];
