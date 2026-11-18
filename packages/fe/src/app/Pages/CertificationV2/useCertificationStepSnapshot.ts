import { CertificationStepSnapshotDto } from '@edanalytics/models';
import { QueryKey, useQuery } from '@tanstack/react-query';
import { methods } from '../../api';
import { certificationQueryKeys, certificationTenantUrl } from './useCertificationCatalog';

/** Where a step's snapshot is read from: the URL and the cache key of one step run. */
export type CertificationSnapshotSource = {
  url: (stepId: number) => string;
  queryKey: (stepId: number, ranAt: string | undefined) => QueryKey;
};

export type UseCertificationStepSnapshotArgs = {
  /** Undefined until the source is known (for the vendor page, until the run has loaded). */
  source: CertificationSnapshotSource | undefined;
  stepId: number | undefined;
  ranAt: string | undefined;
  /** True once the user opens the response panel; the snapshot is never loaded before. */
  enabled: boolean;
};

/** The vendor page's source: the run's snapshot route under its team and tenant. */
export const teamSnapshotSource = (
  teamId: number,
  edfiTenantId: number | undefined,
  runId: number | undefined,
): CertificationSnapshotSource | undefined =>
  edfiTenantId === undefined || runId === undefined
    ? undefined
    : {
        url: (stepId) =>
          `${certificationTenantUrl(teamId, edfiTenantId)}/runs/${runId}/step-runs/${stepId}/snapshot`,
        queryKey: (stepId, ranAt) =>
          certificationQueryKeys.stepSnapshot(teamId, runId, stepId, ranAt),
      };

/** The saved Ed-Fi API response of one step's latest run (AC-690). */
export const useCertificationStepSnapshot = ({
  source,
  stepId,
  ranAt,
  enabled: isOpen,
}: UseCertificationStepSnapshotArgs) => {
  const enabled = isOpen && source !== undefined && stepId !== undefined;
  const query = useQuery({
    queryKey:
      source && stepId !== undefined
        ? source.queryKey(stepId, ranAt)
        : ['certification', 'step-snapshot', 'disabled'],
    queryFn: () => methods.getOne(source!.url(stepId!), CertificationStepSnapshotDto),
    enabled,
  });

  // A disabled query reports isPending forever, so only count it when it can run.
  return {
    snapshot: enabled ? query.data : undefined,
    isPending: enabled && query.isPending,
    isError: enabled && query.isError,
  };
};
