import { CertificationScenarioStatusDto, CertScenarioStatus } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';

type UseCertificationScenarioStatusesArgs = {
  sbEnvironmentId: number;
  edfiTenantId: number | undefined;
  odsId: number | undefined;
  sisVersion: string | undefined;
  enabled: boolean;
};

/**
 * Every scenario's saved status for the current tenant/ODS (AC-689), fetched once and keyed
 * under `certificationQueryKeys.all`: the execution page's existing invalidation after a step
 * run keeps this list fresh too.
 */
export const useCertificationScenarioStatuses = ({
  sbEnvironmentId,
  edfiTenantId,
  odsId,
  sisVersion,
  enabled,
}: UseCertificationScenarioStatusesArgs) => {
  const queryEnabled = enabled && edfiTenantId !== undefined && sisVersion !== undefined;
  const statusesQuery = useQuery({
    queryKey: certificationQueryKeys.scenarioStatuses(sbEnvironmentId, edfiTenantId, odsId),
    queryFn: () =>
      methods.getMany(
        `sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/certification/sis/${sisVersion}/scenario-statuses`,
        CertificationScenarioStatusDto,
        { params: odsId === undefined ? {} : { odsId } },
      ),
    enabled: queryEnabled,
    refetchOnMount: 'always',
    // Only a failed first load goes to the error page; a failed refetch (e.g. after a dropped
    // connection) keeps the page and the statuses already shown.
    throwOnError: (_error, query) => query.state.data === undefined,
  });
  const { data } = statusesQuery;
  const statusByScenarioId = useMemo(
    () =>
      Object.fromEntries((data ?? []).map((item) => [item.scenarioId, item.status])) as Record<
        number,
        CertScenarioStatus
      >,
    [data],
  );

  // A disabled query reports isPending forever, so only count it when it can run.
  return {
    statusByScenarioId,
    isPending: queryEnabled && statusesQuery.isPending,
  };
};
