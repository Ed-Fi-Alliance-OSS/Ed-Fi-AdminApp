import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';
import { applicationQueries } from '../../api';

import { useNavContext } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { useApplicationActions } from './useApplicationActions';

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
  const navContext = useNavContext();
  const asId = navContext.asId!;
  const sbeId = navContext.sbeId!;

  const params = useParams() as {
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: sbeId,
    tenantId: asId,
  }).data;

  return <>{application?.displayName || 'Application'}</>;
};

export const ApplicationPageContent = () => {
  const navContext = useNavContext();
  const asId = navContext.asId!;
  const sbeId = navContext.sbeId!;
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: sbeId,
    tenantId: asId,
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
  const navContext = useNavContext();
  const asId = navContext.asId!;
  const sbeId = navContext.sbeId!;
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: sbeId,
    tenantId: asId,
  }).data;

  const actions = useApplicationActions({
    application,
    sbeId: sbeId,
    tenantId: asId,
  });

  return <ActionBarActions actions={_.omit(actions, 'View')} />;
};
