import { CertificationStepRunDto, PostCertificationStepRunDto } from '@edanalytics/models';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from './apiClient';

export type RunCertificationStepVariables = {
  teamId: number;
  edfiTenantId: number;
  /** The run the step belongs to; it fixes the data store. */
  runId: number;
  stepId: number;
  /** Client-side cache scope, not part of the API request. */
  scenarioId: number;
  body: PostCertificationStepRunDto;
};

export type RunCertificationStepHandlers = {
  onSuccess: (result: CertificationStepRunDto, variables: RunCertificationStepVariables) => void;
  onError: (error: unknown, variables: RunCertificationStepVariables) => void;
};

/**
 * Runs one certification step through Bruno (AC-466). The result is 200 whether it passed or failed.
 * The handlers belong to the mutation itself, so they still run if the page resets the observer
 * (for example when the vendor opens another step) while a run is in flight.
 */
export const useRunCertificationStep = (handlers: RunCertificationStepHandlers) =>
  useMutation({
    // Don't keep the submitted ODS token in the mutation cache after unmount.
    gcTime: 0,
    onSuccess: (result: CertificationStepRunDto, variables: RunCertificationStepVariables) =>
      handlers.onSuccess(result, variables),
    onError: (error: unknown, variables: RunCertificationStepVariables) =>
      handlers.onError(error, variables),
    mutationFn: async ({
      teamId,
      edfiTenantId,
      runId,
      stepId,
      body,
    }: RunCertificationStepVariables) =>
      (await apiClient.post(
        `teams/${teamId}/edfi-tenants/${edfiTenantId}/certification/runs/${runId}/steps/${stepId}/run`,
        body,
      )) as unknown as CertificationStepRunDto,
  });
