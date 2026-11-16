import {
  CertificationLatestRunDto,
  CertificationRunDto,
  CertModel,
  PostCertificationRunDto,
} from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { methods } from '../../api';
// Import the file directly: the api-v2 index pulls in more than this hook needs.
import { apiClient } from '../../api-v2/apiClient';
import { certificationQueryKeys, certificationTenantUrl } from './useCertificationCatalog';

/** The run ID of the address (`:runId`), or undefined when it isn't a positive whole number. */
export const toRunId = (value: string | undefined): number | undefined => {
  const runId = Number(value);
  return value && Number.isInteger(runId) && runId > 0 ? runId : undefined;
};

/**
 * One certification run (AC-651). The Scenarios page's address only has the run ID, so this is
 * how it learns the run's environment, tenant, data store and Certification Model. A run the
 * user may not see is a 404, which goes to the route error page.
 */
export const useCertificationRun = (teamId: number, runId: number | undefined) => {
  const enabled = runId !== undefined;
  const runQuery = useQuery({
    queryKey: certificationQueryKeys.run(teamId, runId),
    queryFn: () =>
      methods.getOne(`teams/${teamId}/certification/runs/${runId}`, CertificationRunDto),
    enabled,
    throwOnError: true,
  });
  // A disabled query reports isPending forever, so only count it when it can run.
  return { run: enabled ? runQuery.data : undefined, isPending: enabled && runQuery.isPending };
};

/**
 * The newest run of each Certification Model on a data store. A model whose newest run is
 * open can't be started again, so the Request New Certification popup disables it.
 */
export const useLatestCertificationRuns = ({
  teamId,
  edfiTenantId,
  odsId,
}: {
  teamId: number;
  edfiTenantId: number | undefined;
  odsId: number | undefined;
}) => {
  const enabled = edfiTenantId !== undefined && odsId !== undefined;
  const latestQuery = useQuery({
    queryKey: certificationQueryKeys.latestRuns(teamId, edfiTenantId, odsId),
    queryFn: () =>
      methods.getMany(
        `${certificationTenantUrl(teamId, edfiTenantId)}/runs/latest`,
        CertificationLatestRunDto,
        { params: { odsId } },
      ),
    enabled,
    // A run can be approved or rejected while the page stays open.
    refetchOnMount: 'always',
  });
  const data = enabled ? latestQuery.data : undefined;
  const latestByModel = useMemo(
    () =>
      Object.fromEntries((data ?? []).map((run) => [run.certificationModel, run])) as Partial<
        Record<CertModel, CertificationLatestRunDto>
      >,
    [data],
  );
  return { latestByModel, isPending: enabled && latestQuery.isPending };
};

export type StartCertificationRunVariables = {
  teamId: number;
  edfiTenantId: number;
  body: PostCertificationRunDto;
};

/** Starts a Draft run. A data store with an open run of the model answers 409. */
export const useStartCertificationRun = () => {
  const queryClient = useQueryClient();
  // After a refusal too: a 409 means another tab or teammate started the run meanwhile.
  const refresh = (_result: unknown, { teamId }: StartCertificationRunVariables) =>
    queryClient.invalidateQueries({ queryKey: certificationQueryKeys.all(teamId) });
  return useMutation({
    mutationFn: async ({ teamId, edfiTenantId, body }: StartCertificationRunVariables) =>
      (await apiClient.post(
        `${certificationTenantUrl(teamId, edfiTenantId)}/runs`,
        body,
      )) as unknown as CertificationRunDto,
    onSuccess: refresh,
    onError: refresh,
  });
};

/** The server's reason a run wasn't started: a validation message, or an HTTP error's message. */
export const certificationRunErrorMessage = (error: unknown): string => {
  const { data, message } = (error ?? {}) as {
    data?: { errors?: Record<string, { message?: string }> };
    message?: unknown;
  };
  const validation =
    data?.errors && Object.values(data.errors).find((item) => item?.message)?.message;
  if (validation) return validation;
  return typeof message === 'string' && message
    ? message
    : "The run couldn't be started. Try again.";
};
