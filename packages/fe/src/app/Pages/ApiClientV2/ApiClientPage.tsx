import {
  OneTimeShareCredentials,
  PageActions,
  PageContentCard,
  PageTemplate,
} from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';

import {
  GetApiClientDtoV2,
} from '@edanalytics/models';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApiClient } from './EditApiClient';
import { ViewApiClient } from './ViewApiClient';
import { useSingleApiClientActions } from './useApiClientActions';

export const ApiClientPageV2 = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'ApiClient'}>
          <ApiClientPageTitle />
        </ErrorBoundary>
      }
      actions={<ApiClientPageActions />}
      customPageContentCard
    >
      <PageContentCard>
        <ApiClientPageContent />
      </PageContentCard>
      <OneTimeShareCredentials />
    </PageTemplate>
  );
};

export const ApiClientPageTitle = () => {
  const { asId, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();

  const { apiClientId } = useParams();

  const apiClient = {
      id: Number(apiClientId),
      displayName: 'My app credentials 1',
      name: 'My app credentials  1',
      key: 'abc123',
      isApproved: true,
      useSandbox: false,
      keyStatus: "Active",
      odsInstanceIds: [1],
  } as GetApiClientDtoV2;
  return <>{apiClient?.name || 'ApiClient'}</>;
};

export const ApiClientPageContent = () => {
  const { asId, edfiTenantId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    apiClientId: string;
  };

  const apiClient = {
      id: Number(params.apiClientId),
      displayName: 'My app credentials 1',
      name: 'My app credentials  1',
      key: 'abc123',
      isApproved: true,
      useSandbox: false,
      keyStatus: "Active",
      odsInstanceIds: [1],
  } as GetApiClientDtoV2;

  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  return apiClient ? (
    edit ? (
        <EditApiClient apiClient={apiClient} />
    ) : (
      <ViewApiClient apiClient={apiClient} />
    )
  ) : null;
};

export const ApiClientPageActions = () => {
  const { asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const params = useParams() as {
    edfiTenantId: string;
    asId: string;
    apiClientId: string;
  };

  const apiClient = {
      id: Number(params.apiClientId),
      displayName: 'My app credentials 1',
      name: 'My app credentials  1',
      key: 'abc123',
      isApproved: true,
      useSandbox: false,
      keyStatus: "Active",
      odsInstanceIds: [1],
  } as GetApiClientDtoV2;

  const actions = useSingleApiClientActions({
    apiClient,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
