import { CertificationReviewDto } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { toRunId } from '../CertificationV2/useCertificationRun';
import type { CertificationSnapshotSource } from '../CertificationV2/useCertificationStepSnapshot';
import { reviewSnapshotSource, useCertificationReview } from './useCertificationReview';

export const REVIEW_CERTIFICATION: AuthorizeConfig = {
  privilege: 'certification:review',
  subject: { id: '__filtered__' },
};

export type ReviewRun =
  | { state: 'loading' }
  | { state: 'notFound' }
  | {
      state: 'ready';
      runId: number;
      data: CertificationReviewDto;
      /** A refetch got a 404 while the run is cached: another reviewer moved it on. */
      isUnavailable: boolean;
      /** A refetch failed for another reason (network, server error): the cached run may be stale. */
      refetchFailed: boolean;
      /** Loads the run again, after a failed refetch. */
      retry: () => void;
      snapshotSource: CertificationSnapshotSource;
    };

/** The review endpoint answers 404 once the run can no longer be read for review. */
const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { statusCode?: unknown }).statusCode === 404;

/**
 * The run of the review pages' address, behind their shared guards: a privilege-cache failure and
 * a missing `certification:review` throw to the route error page (as does a failed first load),
 * and a refetch failure keeps the cached run readable: a 404 flags it unavailable, any other
 * failure flags it for a retry. `disabled` stops the run's query for good,
 * for a page that is leaving because the run can no longer be read.
 */
export const useReviewRun = ({ disabled = false }: { disabled?: boolean } = {}): ReviewRun => {
  const queryClient = useQueryClient();
  const runId = toRunId(useParams().runId);
  // Until the privilege cache arrives authorize() is false, which must not read as "not allowed".
  const privilegeCache = usePrivilegeCacheForConfig(REVIEW_CERTIFICATION);
  const canReview = authorize({ queryClient, config: REVIEW_CERTIFICATION });
  const { data, error, isLoading, refetch } = useCertificationReview(runId, canReview && !disabled);
  const snapshotSource = useMemo(
    () => (runId === undefined ? undefined : reviewSnapshotSource(runId)),
    [runId],
  );

  // A failed privilege-cache request is not a denial either: show the real error.
  const privilegeCacheError = privilegeCache.find((cache) => cache.error)?.error;
  if (privilegeCacheError) {
    throw privilegeCacheError;
  }
  if (privilegeCache.some((cache) => cache.isLoading)) {
    return { state: 'loading' };
  }
  if (!canReview) {
    // Caught by the route errorElement (ErrorFallback), which displays the message.
    throw new Error('Not allowed');
  }
  if (runId === undefined || !snapshotSource) {
    return { state: 'notFound' };
  }
  if (error && !data) {
    // A failed request is not a denial: show the real error, not "Not allowed".
    throw error;
  }
  if (isLoading || !data) {
    return { state: 'loading' };
  }
  const isUnavailable = isNotFound(error);
  return {
    state: 'ready',
    runId,
    data,
    isUnavailable,
    refetchFailed: Boolean(error) && !isUnavailable,
    retry: () => void refetch(),
    snapshotSource,
  };
};
