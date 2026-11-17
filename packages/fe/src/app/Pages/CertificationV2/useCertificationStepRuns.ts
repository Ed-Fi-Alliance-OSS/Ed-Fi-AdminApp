import {
  CertificationSavedStepRunDto,
  CertificationStepRunsDto,
  CertScenarioStatus,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { methods } from '../../api';
import { certificationQueryKeys, certificationTenantUrl } from './useCertificationCatalog';

type UseCertificationStepRunsArgs = {
  teamId: number;
  /** The run's tenant; undefined until the run has loaded. */
  edfiTenantId: number | undefined;
  runId: number | undefined;
  scenarioId: number | undefined;
};

/**
 * The saved result of each step of one scenario of a run (AC-475). Reading results needs no
 * ODS token, so a returning vendor sees them before validating their credentials again.
 */
export const useCertificationStepRuns = ({
  teamId,
  edfiTenantId,
  runId,
  scenarioId,
}: UseCertificationStepRunsArgs) => {
  const queryKey = certificationQueryKeys.stepRuns(teamId, runId, scenarioId);
  const enabled = edfiTenantId !== undefined && scenarioId !== undefined && runId !== undefined;
  const stepRunsQuery = useQuery({
    queryKey,
    queryFn: () =>
      methods.getOne(
        `${certificationTenantUrl(teamId, edfiTenantId)}/runs/${runId}/step-runs`,
        CertificationStepRunsDto,
        { params: { scenarioId } },
      ),
    enabled,
    // Only a failed first load goes to the error page; a failed refetch (e.g. after a dropped
    // connection) keeps the page, the vendor's typed inputs and the results already shown.
    throwOnError: (_error, query) => query.state.data === undefined,
  });
  const { refetch } = stepRunsQuery;
  const data = enabled ? stepRunsQuery.data : undefined;
  const runsByStepId = useMemo(
    () =>
      Object.fromEntries((data?.steps ?? []).map((step) => [step.stepId, step])) as Record<
        number,
        CertificationSavedStepRunDto
      >,
    [data],
  );
  const scenarioStatus: CertScenarioStatus | null = data?.scenarioStatus ?? null;

  // A disabled query reports isPending forever, so only count it when it can run.
  return {
    runsByStepId,
    scenarioStatus,
    isPending: enabled && stepRunsQuery.isPending,
    refetch: () => {
      if (enabled) void refetch();
    },
    queryKey,
  };
};
