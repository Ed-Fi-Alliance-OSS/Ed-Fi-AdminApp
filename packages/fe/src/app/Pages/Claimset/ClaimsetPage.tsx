import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';
import { claimsetQueries } from '../../api';
import { ViewClaimset } from './ViewClaimset';
import { useClaimsetActions } from './useClaimsetActions';

export const ClaimsetPage = () => {
  return (
    <PageTemplate
      constrainWidth
      title={
        <ErrorBoundary fallbackRender={() => 'Claimset'}>
          <ClaimsetPageTitle />
        </ErrorBoundary>
      }
      actions={<ClaimsetPageActions />}
    >
      <ClaimsetPageContent />
    </PageTemplate>
  );
};

export const ClaimsetPageTitle = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    claimsetId: string;
  };
  const claimset = claimsetQueries.useOne({
    enabled: params.asId !== undefined,
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return <>{claimset?.displayName || 'Claimset'}</>;
};

export const ClaimsetPageContent = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    claimsetId: string;
  };
  const claimset = claimsetQueries.useOne({
    enabled: params.asId !== undefined,
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return claimset ? <ViewClaimset /> : null;
};
export const ClaimsetPageActions = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    claimsetId: string;
  };
  const claimset = claimsetQueries.useOne({
    enabled: params.asId !== undefined,
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  const actions = useClaimsetActions({
    claimset,
  });

  return <ActionBarActions actions={_.omit(actions, 'View')} />;
};
