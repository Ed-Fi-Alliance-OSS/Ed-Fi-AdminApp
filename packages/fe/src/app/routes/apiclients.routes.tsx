import { Link, Text } from '@chakra-ui/react';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import {
  VersioningHoc,
  getEntityFromQuery,
  getRelationDisplayName,
  useTeamEdfiTenantNavContextLoaded,
  withLoader,
} from '../helpers';
import { ApiClientsPageV2 } from '../Pages/ApiClientV2/ApiClientsPage';
import { ApiClientPageV2 } from '../Pages/ApiClientV2/ApiClientPage';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { apiClientQueriesV2 } from '../api';

const ApiClientBreadcrumbV2 = () => {
  const params = useParams() as {
    applicationId: string;
    apiClientId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const apiClient = useQuery(
      apiClientQueriesV2.getOne({
        id: params.apiClientId,
        edfiTenant,
        teamId,
      }, {})
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (apiClient.data?.displayName ?? params.apiClientId) as any;
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
    fallbackCrumb: () => 'Credentials',
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
  query: UseQueryResult<Record<string | number, GetApiClientDtoV2>, unknown>;
  edfiTenantId?: string | number;
}) => {

  const apiClient = getEntityFromQuery(props.id, props.query);
      
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return apiClient ? (
    <Link as="span">
      <RouterLink
        title="Go to application credentials"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${props.applicationId}/apiclients/${props.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Credentials may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};