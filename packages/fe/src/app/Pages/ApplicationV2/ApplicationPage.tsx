import {
  OneTimeShareLink,
  PageActions,
  PageContentCard,
  PageTemplate,
} from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';
import { applicationQueriesV2, claimsetQueriesV2 } from '../../api';

import {
  GetApplicationDtoV2,
  GetClaimsetMultipleDtoV2,
  GetIntegrationAppDto,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { useSingleApplicationActions } from './useApplicationActions';
import { useGetOneApplication } from '../../api-v2';

export const ApplicationPageV2 = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Application'}>
          <ApplicationPageTitle />
        </ErrorBoundary>
      }
      actions={<ApplicationPageActions />}
      customPageContentCard
    >
      <PageContentCard>
        <ApplicationPageContent />
      </PageContentCard>
      <OneTimeShareLink />
    </PageTemplate>
  );
};

export const ApplicationPageTitle = () => {
  const { asId, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();

  const { applicationId } = useParams();

  const { data: application } = useGetOneApplication({
    queryArgs: {
      applicationId: Number(applicationId),
      edfiTenantId,
      teamId: asId,
    },
  });

  return <>{application?.applicationName || 'Application'}</>;
};

export const ApplicationPageContent = () => {
  const { asId, edfiTenantId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    applicationId: string;
  };

  const { data: application } = useGetOneApplication({
    queryArgs: {
      applicationId: Number(params.applicationId),
      edfiTenantId,
      teamId: asId,
      getIntegrationAppDetails: true,
    },
  });

  const claimsets = useQuery(
    claimsetQueriesV2.getAll({
      edfiTenant: edfiTenant,
      teamId: asId,
    })
  );
  const claimsetsByName = Object.values(claimsets.data ?? {}).reduce<
    Record<string, GetClaimsetMultipleDtoV2>
  >((map, claimset) => {
    map[claimset.name] = claimset;
    return map;
  }, {});
  const claimset =
    claimsetsByName && application ? claimsetsByName[application.claimSetName] : undefined;

  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  return application ? (
    edit ? (
      claimsets.isSuccess ? (
        <EditApplication application={application} claimset={claimset} />
      ) : null
    ) : (
      <ViewApplication application={application} />
    )
  ) : null;
};

export const ApplicationPageActions = () => {
  const { asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    applicationId: string;
  };

  const application = useQuery(
    applicationQueriesV2.getOne({
      id: params.applicationId,
      edfiTenant: edfiTenant,
      teamId: asId,
    })
  ).data as GetApplicationDtoV2 & GetIntegrationAppDto;

  const actions = useSingleApplicationActions({
    application,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
