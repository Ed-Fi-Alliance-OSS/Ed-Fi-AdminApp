import { CertificationScenarioStatusesDto, CertScenarioStatus } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { methods } from '../../api';
import { certificationQueryKeys, certificationTenantUrl } from './useCertificationCatalog';

type UseCertificationScenarioStatusesArgs = {
  teamId: number;
  /** The run's tenant; undefined until the run has loaded. */
  edfiTenantId: number | undefined;
  runId: number | undefined;
  enabled: boolean;
};

/**
 * One run's status and every scenario's saved status in it (AC-689, AC-649, AC-651), keyed under
 * `certificationQueryKeys.scenarioStatuses`. It refetches on every mount, so a step saved on
 * the execution page shows when the vendor comes back; that page also invalidates the key
 * after a step run.
 *
 * `isUnknown` is true until a list has loaded (query not runnable yet, loading, or failed).
 * It is not the same as an empty list: with a loaded list, a scenario that has no entry
 * really has no saved result.
 *
 * `canExecuteSteps` is false only when the loaded run can't take step runs (it is in or
 * waiting for review, or finished). An unknown run doesn't block: the API refuses the step
 * run instead.
 */
export const useCertificationScenarioStatuses = ({
  teamId,
  edfiTenantId,
  runId,
  enabled,
}: UseCertificationScenarioStatusesArgs) => {
  const queryEnabled = enabled && edfiTenantId !== undefined && runId !== undefined;
  const statusesQuery = useQuery({
    queryKey: certificationQueryKeys.scenarioStatuses(teamId, runId),
    queryFn: () =>
      methods.getOne(
        `${certificationTenantUrl(teamId, edfiTenantId)}/runs/${runId}/scenario-statuses`,
        CertificationScenarioStatusesDto,
      ),
    enabled: queryEnabled,
    refetchOnMount: 'always',
  });
  const { data } = statusesQuery;
  const statusByScenarioId = useMemo(
    () =>
      Object.fromEntries(
        (data?.scenarios ?? []).map((item) => [item.scenarioId, item.status]),
      ) as Record<number, CertScenarioStatus>,
    [data],
  );

  return {
    statusByScenarioId,
    run: data?.run,
    canExecuteSteps: data?.run?.canExecuteSteps !== false,
    isUnknown: data === undefined,
    // A disabled query reports isPending forever, so only count it when it can run.
    isLoading: queryEnabled && statusesQuery.isPending,
    isError: queryEnabled && statusesQuery.isError,
    // A failed refresh that left older statuses on screen.
    isStale: statusesQuery.isError && data !== undefined,
    refetch: statusesQuery.refetch,
  };
};
