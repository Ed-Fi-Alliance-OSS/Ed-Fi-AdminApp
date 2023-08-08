import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { applicationQueries } from '../../api';
import { ActionBarActions } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { PageTemplate } from '../PageTemplate';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { useApplicationActions } from './useApplicationActions';
import { ErrorBoundary } from 'react-error-boundary';

export const ApplicationPage = () => {
  return (
    <PageTemplate
      constrainWidth
      title={
        <ErrorBoundary fallbackRender={() => 'Application'}>
          <ApplicationPageTitle />
        </ErrorBoundary>
      }
      actions={<ApplicationPageActions />}
    >
      <ApplicationPageContent />
    </PageTemplate>
  );
};

export const ApplicationPageTitle = () => {
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return <>{application?.displayName || 'Application'}</>;
};

export const ApplicationPageContent = () => {
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  return application ? (
    edit ? (
      <EditApplication application={application} />
    ) : (
      <ViewApplication />
    )
  ) : null;
};

export const ApplicationPageActions = () => {
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  const actions = useApplicationActions({
    application,
    sbeId: params.sbeId,
    tenantId: params.asId,
  });

  return <ActionBarActions actions={_.omit(actions, 'View')} />;
};
