import { GetProfileDtoV2 } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import {
  getEntityFromQuery,
  getRelationDisplayName,
  useTeamEdfiTenantNavContextLoaded,
  withLoader,
} from '../helpers';
import { Link, Text } from '@chakra-ui/react';
import { profileQueriesV2 } from '../api/queries/queries.v7';
import { ProfilesPage } from '../Pages/Profile/ProfilesPage';
import { ProfilePageV2 } from '../Pages/Profile/ProfilePage';
import { CreateProfile } from '../Pages/Profile/CreateProfilePage';
const ProfileBreadcrumb = () => {
  const params = useParams() as {
    profileId: string;
  };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const profile = useQuery(
    profileQueriesV2.getOne({
      id: params.profileId,
      teamId,
      edfiTenant,
    })
  );
  return (profile.data?.name ?? params.profileId) as any;
};
export const profileCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/create',
  element: <CreateProfile />,
  handle: { crumb: () => 'Create Profile' },
};
export const profileIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/:profileId/',
  element: <ProfilePageV2 />,
};

export const profileRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/:profileId',
  handle: {
    crumb: withLoader(() => <ProfileBreadcrumb />),
  },
};
export const profilesIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles/',
  element: <ProfilesPage />,
};
export const profilesRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/profiles',
  handle: { crumb: () => 'Profiles' },
};
export const ProfileLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetProfileDtoV2>, unknown>;
}) => {
  const profile = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return profile ? (
    <Link as="span">
      <RouterLink
        title="Go to profile"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles/${profile.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Profile may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
