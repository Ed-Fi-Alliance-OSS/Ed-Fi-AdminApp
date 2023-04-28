import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetResourceDto } from '@edanalytics/models';
import { mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { useResources } from '../api';
import { ResourcePage } from '../Pages/Resource/ResourcePage';
import { ResourcesPage } from '../Pages/Resource/ResourcesPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const resourcesRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: 'resources',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Resources', params }),
  }),
});

export const resourcesIndexRoute = new Route({
  getParentRoute: () => resourcesRoute,
  path: '/',
  component: ResourcesPage,
});

const ResourceBreadcrumb = () => {
  const params = useParams({ from: resourceRoute.id });
  const resource = useResources();
  return resource.data?.[params.resourceId]?.displayName ?? params.resourceId;
};

export const resourceRoute = new Route({
  getParentRoute: () => resourcesRoute,
  path: '$resourceId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: ResourceBreadcrumb, params }),
    };
  },
});

export const resourceIndexRoute = new Route({
  getParentRoute: () => resourceRoute,
  path: '/',
  component: ResourcePage,
});

export const ResourceLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetResourceDto>, unknown>;
}) => {
  const resource = getEntityFromQuery(props.id, props.query);
  return resource ? (
    <Link as="span">
      <RouterLink
        title="Go to resource"
        to={resourceRoute.fullPath}
        params={{
          resourceId: String(resource.id),
        }}
      >
        {getRelationDisplayName(resource.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Resource may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
