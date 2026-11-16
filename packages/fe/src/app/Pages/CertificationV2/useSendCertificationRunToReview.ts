import { CertificationRunDto } from '@edanalytics/models';
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import the file directly: the api-v2 index pulls in more than this hook needs.
import { apiClient } from '../../api-v2/apiClient';
import { certificationQueryKeys, certificationTenantUrl } from './useCertificationCatalog';

export type SendCertificationRunToReviewVariables = {
  teamId: number;
  edfiTenantId: number;
  runId: number;
};

/**
 * Sends a run to review (AC-659). The API answers 409 when the run can't be sent from its
 * status or a scenario hasn't succeeded.
 */
export const useSendCertificationRunToReview = () => {
  const queryClient = useQueryClient();
  // After a refusal too: a 409 can mean a step result or another tab changed the run meanwhile.
  const refresh = (_result: unknown, { teamId }: SendCertificationRunToReviewVariables) =>
    queryClient.invalidateQueries({ queryKey: certificationQueryKeys.all(teamId) });
  return useMutation({
    mutationFn: async ({ teamId, edfiTenantId, runId }: SendCertificationRunToReviewVariables) =>
      (await apiClient.post(
        `${certificationTenantUrl(teamId, edfiTenantId)}/runs/${runId}/send-to-review`,
        {},
      )) as unknown as CertificationRunDto,
    onSuccess: refresh,
    onError: refresh,
  });
};
