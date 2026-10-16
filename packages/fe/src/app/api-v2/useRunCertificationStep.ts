import { CertificationStepRunDto, PostCertificationStepRunDto } from '@edanalytics/models';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from './apiClient';

export type RunCertificationStepVariables = {
  sbEnvironmentId: number;
  edfiTenantId: number;
  sisVersion: string;
  stepId: number;
  body: PostCertificationStepRunDto;
};

/** Runs one certification step through Bruno (AC-466). The result is 200 whether it passed or failed. */
export const useRunCertificationStep = () =>
  useMutation({
    // Don't keep the submitted ODS token in the mutation cache after unmount.
    gcTime: 0,
    mutationFn: async ({
      sbEnvironmentId,
      edfiTenantId,
      sisVersion,
      stepId,
      body,
    }: RunCertificationStepVariables) =>
      (await apiClient.post(
        `sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/certification/sis/${sisVersion}/steps/${stepId}/run`,
        body,
      )) as unknown as CertificationStepRunDto,
  });
