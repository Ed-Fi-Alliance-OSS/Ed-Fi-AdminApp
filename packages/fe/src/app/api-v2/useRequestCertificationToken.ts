import { CertificationTokenDto, PostCertificationTokenDto } from '@edanalytics/models';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from './apiClient';

export const useRequestCertificationToken = () =>
  useMutation({
    // Don't keep the submitted key/secret in the mutation cache after unmount.
    gcTime: 0,
    mutationFn: async ({
      teamId,
      edfiTenantId,
      body,
    }: {
      teamId: number;
      edfiTenantId: number;
      body: PostCertificationTokenDto;
    }) =>
      (await apiClient.post(
        `teams/${teamId}/edfi-tenants/${edfiTenantId}/certification/token`,
        body,
      )) as unknown as CertificationTokenDto,
  });

/** Pulls the server's message out of a ValidationHttpException body. */
export const certificationTokenErrorMessage = (error: unknown): string => {
  const errors = (error as { data?: { errors?: Record<string, { message?: string }> } })?.data
    ?.errors;
  const message = errors && Object.values(errors).find((e) => e?.message)?.message;
  return message ?? 'Authentication failed. Try again.';
};
