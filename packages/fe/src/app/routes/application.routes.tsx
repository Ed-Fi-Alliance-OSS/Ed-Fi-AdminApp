import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetApplicationDto } from '@edanalytics/models';
import { mainLayoutRoute, sbeRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { applicationQueries } from '../api';
import { ApplicationPage } from '../Pages/Application/ApplicationPage';
import { ApplicationsPage } from '../Pages/Application/ApplicationsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const applicationsRoute = new Route({
  getParentRoute: () => sbeRoute,
  path: 'applications',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Applications', params }),
  }),
});

export const applicationsIndexRoute = new Route({
  getParentRoute: () => applicationsRoute,
  path: '/',
  component: ApplicationsPage,
});

const ApplicationBreadcrumb = () => {
  const params = useParams({ from: applicationRoute.id });
  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  return application.data?.displayName ?? params.applicationId;
};

export const applicationRoute = new Route({
  getParentRoute: () => applicationsRoute,
  path: '$applicationId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: ApplicationBreadcrumb, params }),
    };
  },
});

export const applicationIndexRoute = new Route({
  getParentRoute: () => applicationRoute,
  path: '/',
  component: ApplicationPage,
});

export const ApplicationLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetApplicationDto>, unknown>;
  sbeId: string;
}) => {
  const application = getEntityFromQuery(props.id, props.query);
  return application ? (
    <Link as="span">
      <RouterLink
        title="Go to application"
        to={applicationRoute.fullPath}
        params={(previous: any) => ({
          ...previous,
          applicationId: String(application.id),
          sbeId: props.sbeId,
        })}
      >
        {getRelationDisplayName(application.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Application may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
