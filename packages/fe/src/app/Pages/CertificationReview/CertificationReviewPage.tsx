import { Alert, AlertIcon, Box, Button, HStack, Spinner, Text } from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { CERT_REVIEW_DECISION, CertReviewDecision } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { routeDefinitions } from '../../routes/paths';
import { toRunId } from '../CertificationV2/useCertificationRun';
import { CertificationReviewDecisionModal } from './CertificationReviewDecisionModal';
import { CertificationReviewHeader } from './CertificationReviewHeader';
import { CertificationReviewScenarios } from './CertificationReviewScenarios';
import {
  certificationReviewQueryKeys,
  reviewSnapshotSource,
  useCertificationReview,
} from './useCertificationReview';

const TITLE = 'Review certification run';

const REVIEW_CERTIFICATION: AuthorizeConfig = {
  privilege: 'certification:review',
  subject: { id: '__filtered__' },
};

const DECISION_BUTTONS: { decision: CertReviewDecision; label: string; colorScheme: string }[] = [
  { decision: CERT_REVIEW_DECISION.APPROVED, label: 'Approve', colorScheme: 'green' },
  { decision: CERT_REVIEW_DECISION.REJECTED, label: 'Reject', colorScheme: 'red' },
  {
    decision: CERT_REVIEW_DECISION.CHANGES_REQUESTED,
    label: 'Request changes',
    colorScheme: 'orange',
  },
];

/** A global admin reads a run's results and snapshots and decides it. Nothing here runs steps. */
export const CertificationReviewPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const runId = toRunId(useParams().runId);
  const [decision, setDecision] = useState<CertReviewDecision | null>(null);
  // Set after Request changes: the run is no longer readable, so the page must never fetch it again.
  const [isLeaving, setLeaving] = useState(false);
  const isLeavingRef = useRef(false);
  // Until the privilege cache arrives authorize() is false, which must not read as "not allowed".
  const privilegeCache = usePrivilegeCacheForConfig(REVIEW_CERTIFICATION);
  const canReview = authorize({ queryClient, config: REVIEW_CERTIFICATION });
  const { data, error, isLoading } = useCertificationReview(runId, canReview && !isLeaving);
  const snapshotSource = useMemo(
    () => (runId === undefined ? undefined : reviewSnapshotSource(runId)),
    [runId],
  );

  // Dropped only once the page is gone: removed while mounted, its observer would refetch a 404.
  useEffect(
    () => () => {
      if (isLeavingRef.current && runId !== undefined) {
        queryClient.removeQueries({ queryKey: certificationReviewQueryKeys.review(runId) });
      }
    },
    [queryClient, runId],
  );

  // A failed privilege-cache request is not a denial either: show the real error.
  const privilegeCacheError = privilegeCache.find((cache) => cache.error)?.error;
  if (privilegeCacheError) {
    throw privilegeCacheError;
  }

  if (privilegeCache.some((cache) => cache.isLoading)) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  if (!canReview) {
    // Caught by the route errorElement (ErrorFallback), which displays the message.
    throw new Error('Not allowed');
  }

  if (runId === undefined || !snapshotSource) {
    return (
      <PageTemplate title={TITLE}>
        <Alert status="warning">
          <AlertIcon />
          This certification run wasn&apos;t found.
        </Alert>
      </PageTemplate>
    );
  }

  if (error) {
    // A failed request is not a denial: show the real error, not "Not allowed".
    throw error;
  }

  if (isLoading || !data) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

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
    <PageTemplate title={TITLE}>
      <CertificationReviewHeader run={data.run} />

      {data.run.canDecide && (
        <HStack role="group" aria-label="Decision" spacing={2} mb={4}>
          {DECISION_BUTTONS.map(({ decision: value, label, colorScheme }) => (
            <Button key={value} colorScheme={colorScheme} onClick={() => setDecision(value)}>
              {label}
            </Button>
          ))}
        </HStack>
      )}

      <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
        <Text mb={3} fontWeight="semibold">
          Scenarios
        </Text>
        <CertificationReviewScenarios scenarios={data.scenarios} snapshotSource={snapshotSource} />
      </Box>

      <CertificationReviewDecisionModal
        runId={runId}
        decision={decision}
        onClose={() => setDecision(null)}
        onDecided={onDecided}
      />
    </PageTemplate>
  );
};
