import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';
import { claimsetQueries } from '../../api';
import { useClaimsetActions } from './useClaimsetActions';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditClaimset } from './EditClaimset';
import { Suspense, lazy } from 'react';
const ViewClaimset = lazy(() => import('./ViewClaimset'));

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
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  return claimset ? (
    edit ? (
      <EditClaimset claimset={claimset} />
    ) : (
      <Suspense fallback={<div>Loading...</div>}>
        <ViewClaimset />
      </Suspense>
    )
  ) : null;
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

  return <PageActions actions={omit(actions, 'View')} />;
};
