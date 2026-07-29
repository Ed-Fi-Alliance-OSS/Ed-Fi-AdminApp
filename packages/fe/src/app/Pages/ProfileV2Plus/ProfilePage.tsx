import { useQuery } from '@tanstack/react-query';
import {
  Attribute,
  AttributesGrid,
  ContentSection,
  PageActions,
  PageTemplate,
} from '@edanalytics/common-ui';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';
import { profileQueriesV2 } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditProfile } from './EditProfile';
import { useProfileActions } from './useProfileActions';
import omit from 'lodash/omit';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import xmlFormatter from 'xml-formatter';
import { Box, HStack, Text } from '@chakra-ui/react';
import { GetProfileDtoV2 } from '@edanalytics/models';

export const ProfilePageContent = (props: { profile: GetProfileDtoV2 | undefined }) => {
  const { profile } = props;

  const { edit } = useSearchParamsObject() as { edit?: boolean };

  return profile ? (
    edit ? (
      <EditProfile profile={profile} />
    ) : (
      <ViewProfile profile={profile} />
    )
  ) : null;
};

const ProfilePageTitle = (props: { profile: GetProfileDtoV2 | undefined }) => {
  const { profile } = props;

  return <>{profile?.name || 'Profile'}</>;
};

export const ProfilePageV2 = () => {
  const params = useParams() as {
    profileId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const profile = useQuery(
    profileQueriesV2.getOne({
      teamId,
      id: params.profileId,
      edfiTenant,
    })
  ).data;
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Profile'}>
          <ProfilePageTitle profile={profile} />
        </ErrorBoundary>
      }
      actions={<ProfilePageActions profile={profile} />}
    >
      <ErrorBoundary fallbackRender={() => 'Could not load profile'}>
        <ProfilePageContent profile={profile} />
      </ErrorBoundary>
    </PageTemplate>
  );
};

export const ProfilePageActions = (props: { profile: GetProfileDtoV2 | undefined }) => {
  const { profile } = props;

  const actions = useProfileActions(profile);
  return <PageActions actions={omit(actions, 'View')} />;
};

export const ViewProfile = (props: { profile: GetProfileDtoV2 }) => {
  const { profile } = props;
  const formattedXml = xmlFormatter(profile?.definition || '');

  return profile ? (
    <HStack p="3" alignItems={'start'} justifyContent={'space-between'}>
      <Box>
        <Text color="gray.500" fontSize={'medium'}>
          Name
        </Text>
        <Text>{profile.name}</Text>
      </Box>
      <Box>
        <Text color="gray.500" fontSize={'medium'}>
          Definition
        </Text>
        <pre>{formattedXml}</pre>
      </Box>
    </HStack>
  ) : null;
};
