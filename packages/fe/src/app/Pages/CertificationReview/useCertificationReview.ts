import {
  CertificationReviewDto,
  CertificationReviewStatusDto,
  CertReviewDecision,
} from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { CERTIFICATION_DASHBOARD_QUERY_KEY } from '../CertificationDashboard/useCertificationDashboard';
import type { CertificationSnapshotSource } from '../CertificationV2/useCertificationStepSnapshot';

export const certificationReviewQueryKeys = {
  all: [QUERY_KEYS.certification, 'review'] as const,
  review: (runId: number) => [...certificationReviewQueryKeys.all, runId] as const,
  snapshot: (runId: number, stepId: number, ranAt: string | undefined) =>
    [...certificationReviewQueryKeys.all, runId, 'snapshot', stepId, ranAt] as const,
};

const reviewUrl = (runId: number) => `certification/runs/${runId}`;

/**
 * The run's results as a global admin reads them. A refetch that fails keeps the data on screen.
 * The run can be sent again with new results between two visits, so it's never cached past the
 * review pages (gcTime 0: each visit loads it before showing decisions) and always refetched
 * when a review page opens (staleTime 0).
 */
export const useCertificationReview = (runId: number | undefined, enabled: boolean) =>
  useQuery({
    queryKey: certificationReviewQueryKeys.review(runId as number),
    queryFn: async () =>
      (await apiClient.get(
        `${reviewUrl(runId as number)}/review`,
      )) as unknown as CertificationReviewDto,
    enabled: enabled && runId !== undefined,
    staleTime: 0,
    gcTime: 0,
    throwOnError: (_error, query) => query.state.data === undefined,
  });

/** Step snapshots of a run in review, read through the global review endpoint. */
export const reviewSnapshotSource = (runId: number): CertificationSnapshotSource => ({
  url: (stepId) => `${reviewUrl(runId)}/step-runs/${stepId}/snapshot`,
  queryKey: (stepId, ranAt) => certificationReviewQueryKeys.snapshot(runId, stepId, ranAt),
});

/** Picks a run up for review. A 409 means another admin got there first or the run moved on. */
export const usePickUpCertificationRun = () => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: CERTIFICATION_DASHBOARD_QUERY_KEY });
  return useMutation({
    mutationFn: async ({ runId }: { runId: number }) =>
      (await apiClient.post(
        `${reviewUrl(runId)}/pick-up`,
        {},
      )) as unknown as CertificationReviewStatusDto,
    onSuccess: refresh,
    onError: refresh,
  });
};

const DECISION_PATH: Record<CertReviewDecision, string> = {
  APPROVED: 'approve',
  REJECTED: 'reject',
  CHANGES_REQUESTED: 'request-changes',
};

export type CertificationReviewDecisionVariables = {
  runId: number;
  decision: CertReviewDecision;
  comment?: string;
};

/**
 * Approves, rejects or requests changes on a run. After a change request the run is no longer
 * readable, so its review query is left alone here: the page navigates away first and then removes it.
 */
export const useCertificationReviewDecision = () => {
  const queryClient = useQueryClient();
  const invalidateReview = (runId: number) =>
    queryClient.invalidateQueries({ queryKey: certificationReviewQueryKeys.review(runId) });
  const invalidateDashboard = () =>
    queryClient.invalidateQueries({ queryKey: CERTIFICATION_DASHBOARD_QUERY_KEY });
  return useMutation({
    mutationFn: async ({ runId, decision, comment }: CertificationReviewDecisionVariables) =>
      (await apiClient.post(`${reviewUrl(runId)}/${DECISION_PATH[decision]}`, {
        comment,
      })) as unknown as CertificationReviewStatusDto,
    onSuccess: (result, { runId, decision }) => {
      invalidateDashboard();
      if (decision !== 'CHANGES_REQUESTED') {
        // Read-only at once: until the refetch lands, the cached run would still offer decisions.
        queryClient.setQueryData<CertificationReviewDto>(
          certificationReviewQueryKeys.review(runId),
          (old) => old && { ...old, run: { ...old.run, status: result.status, canDecide: false } },
        );
        invalidateReview(runId);
      }
    },
    // A 409 means the run changed under the reviewer: refetch it too.
    onError: (_error, { runId }) => {
      invalidateDashboard();
      invalidateReview(runId);
    },
  });
};
