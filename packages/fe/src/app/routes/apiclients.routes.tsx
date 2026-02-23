import { Link, Text } from '@chakra-ui/react';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import {
  VersioningHoc,
  useTeamEdfiTenantNavContextLoaded,
  withLoader,
} from '../helpers';
import { ApiClientsPageV2 } from '../Pages/ApiClientV2/ApiClientsPage';
import { ApiClientPageV2 } from '../Pages/ApiClientV2/ApiClientPage';

const ApiClientBreadcrumbV2 = () => {
  const params = useParams() as {
    applicationId: string;
    apiClientId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const application = {
    data: 
    {
        id: Number(params.apiClientId),
        displayName: 'My app credentials 1',
        name: 'My app credentials  1',
        key: 'abc123',
        isApproved: true,
        useSandbox: false,
        keyStatus: "Active",
        odsInstanceIds: [1],
    } as GetApiClientDtoV2
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (application.data.displayName ?? params.apiClientId) as any;
};
export const apiClientIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/apiclients/:apiClientId/',
  element: <VersioningHoc v2={<ApiClientPageV2 />} />,
};

export const apiClientRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/apiclients/:apiClientId',
  handle: {
    crumb: withLoader(() => (
      <VersioningHoc v2={<ApiClientBreadcrumbV2 />} />
    )),
    fallbackCrumb: () => 'Api Client',
  },
};
export const apiClientsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/apiclients',
  element: <VersioningHoc v2={<ApiClientsPageV2 />} />,
};
export const apiClientsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/apiclients',
  handle: { crumb: () => 'Credentials' },
};

export const ApiClientLinkV2 = (props: {
  id: number | undefined;
  applicationId: number | undefined;
  edfiTenantId?: string | number;
}) => {
  const apiClient = {
        id: 1,
        name: "My app credentials 1",
        key: "mykey1",
        isApproved: true,
        applicationId: 1,
        odsInstanceIds: [0]
      } as GetApiClientDtoV2;
      
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return apiClient ? (
    <Link as="span">
      <RouterLink
        title="Go to application"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${props.applicationId}/apiclients/${props.id}`}
      >
        {apiClient.name}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Credentials may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};