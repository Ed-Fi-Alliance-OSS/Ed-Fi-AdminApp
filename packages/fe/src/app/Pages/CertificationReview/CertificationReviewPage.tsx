import { Alert, AlertIcon, Button, HStack, Spinner, Text } from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { CERT_REVIEW_DECISION, CertReviewDecision } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { routeDefinitions } from '../../routes/paths';
import { toRunId } from '../CertificationV2/useCertificationRun';
import { CertificationReviewDecisionModal } from './CertificationReviewDecisionModal';
import { CertificationReviewHeader } from './CertificationReviewHeader';
import { CertificationReviewScenariosTable } from './CertificationReviewScenariosTable';
import { certificationReviewQueryKeys } from './useCertificationReview';
import { useReviewRun } from './useReviewRun';

export const REVIEW_PAGE_TITLE = 'Review certification run';

const DECISION_BUTTONS: { decision: CertReviewDecision; label: string; colorScheme: string }[] = [
  { decision: CERT_REVIEW_DECISION.APPROVED, label: 'Approve', colorScheme: 'green' },
  { decision: CERT_REVIEW_DECISION.REJECTED, label: 'Reject', colorScheme: 'red' },
  {
    decision: CERT_REVIEW_DECISION.CHANGES_REQUESTED,
    label: 'Request changes',
    colorScheme: 'orange',
  },
];

/**
 * A global admin's overview of a run: its scenarios, with a way into each one's steps, and the
 * decision. Nothing here runs steps.
 */
export const CertificationReviewPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const runId = toRunId(useParams().runId);
  const [decision, setDecision] = useState<CertReviewDecision | null>(null);
  // Set after Request changes: the run is no longer readable, so the page must never fetch it again.
  const [isLeaving, setLeaving] = useState(false);
  const isLeavingRef = useRef(false);
  const reviewRun = useReviewRun({ disabled: isLeaving });

  // Dropped only once the page is gone: removed while mounted, its observer would refetch a 404.
  useEffect(
    () => () => {
      if (isLeavingRef.current && runId !== undefined) {
        queryClient.removeQueries({ queryKey: certificationReviewQueryKeys.review(runId) });
      }
    },
    [queryClient, runId],
  );

  if (reviewRun.state === 'loading') {
    return (
      <PageTemplate title={REVIEW_PAGE_TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  if (reviewRun.state === 'notFound') {
    return (
      <PageTemplate title={REVIEW_PAGE_TITLE}>
        <Alert status="warning">
          <AlertIcon />
          This certification run wasn&apos;t found.
        </Alert>
      </PageTemplate>
    );
  }

  const { data, isUnavailable } = reviewRun;

  const onDecided = (decided: CertReviewDecision) => {
    if (decided === CERT_REVIEW_DECISION.CHANGES_REQUESTED) {
      // The run is no longer readable: stop its query before leaving, and keep the cached run on
      // screen until the dashboard replaces this page. The unmount cleanup drops it.
      isLeavingRef.current = true;
      setLeaving(true);
      navigate(routeDefinitions.certificationDashboard.index);
      return;
    }
    // Approve and reject stay here: the invalidated review re-renders the run read-only.
    setDecision(null);
  };

  return (
    <PageTemplate title={REVIEW_PAGE_TITLE}>
      {isUnavailable && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <Text flex="1">This run is no longer available for review.</Text>
          <Button size="sm" onClick={() => navigate(routeDefinitions.certificationDashboard.index)}>
            Back to the Certification dashboard
          </Button>
        </Alert>
      )}

      <CertificationReviewHeader run={data.run} />

      {data.run.canDecide && !isUnavailable && (
        <HStack role="group" aria-label="Decision" spacing={2} mb={4}>
          {DECISION_BUTTONS.map(({ decision: value, label, colorScheme }) => (
            <Button key={value} colorScheme={colorScheme} onClick={() => setDecision(value)}>
              {label}
            </Button>
          ))}
        </HStack>
      )}

      <CertificationReviewScenariosTable runId={reviewRun.runId} scenarios={data.scenarios} />

      <CertificationReviewDecisionModal
        runId={reviewRun.runId}
        decision={isUnavailable ? null : decision}
        onClose={() => setDecision(null)}
        onDecided={onDecided}
      />
    </PageTemplate>
  );
};
