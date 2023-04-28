import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetEdorgDto } from '@edanalytics/models';
import { mainLayoutRoute, sbeRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { useEdorgs } from '../api';
import { EdorgPage } from '../Pages/Edorg/EdorgPage';
import { EdorgsPage } from '../Pages/Edorg/EdorgsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const edorgsRoute = new Route({
  getParentRoute: () => sbeRoute,
  path: 'edorgs',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Edorgs', params }),
  }),
});

export const edorgsIndexRoute = new Route({
  getParentRoute: () => edorgsRoute,
  path: '/',
  component: EdorgsPage,
});

const EdorgBreadcrumb = () => {
  const params = useParams({ from: edorgRoute.id });
  const edorg = useEdorgs(params.sbeId!);
  return edorg.data?.[params.edorgId]?.displayName ?? params.edorgId;
};

export const edorgRoute = new Route({
  getParentRoute: () => edorgsRoute,
  path: '$edorgId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: EdorgBreadcrumb, params }),
    };
  },
});

export const edorgIndexRoute = new Route({
  getParentRoute: () => edorgRoute,
  path: '/',
  component: EdorgPage,
});

export const EdorgLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetEdorgDto>, unknown>;
}) => {
  const edorg = getEntityFromQuery(props.id, props.query);
  return edorg ? (
    <Link as="span">
      <RouterLink
        title="Go to edorg"
        to={edorgRoute.fullPath}
        params={{
          sbeId: String(edorg.sbeId),
          edorgId: String(props.id),
        }}
      >
        {getRelationDisplayName(edorg.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Edorg may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
