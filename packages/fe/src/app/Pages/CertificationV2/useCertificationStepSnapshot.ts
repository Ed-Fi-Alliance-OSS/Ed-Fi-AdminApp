import { CertificationStepSnapshotDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { methods } from '../../api';
import { certificationQueryKeys, certificationTenantUrl } from './useCertificationCatalog';

export type UseCertificationStepSnapshotArgs = {
  teamId: number;
  /** The run's tenant; undefined until the run has loaded. */
  edfiTenantId: number | undefined;
  runId: number | undefined;
  stepId: number | undefined;
  ranAt: string | undefined;
  /** True once the vendor opens the response panel; the snapshot is never loaded before. */
  enabled: boolean;
};

/** The saved Ed-Fi API response of one step's latest run (AC-690). */
export const useCertificationStepSnapshot = ({
  teamId,
  edfiTenantId,
  runId,
  stepId,
  ranAt,
  enabled: isOpen,
}: UseCertificationStepSnapshotArgs) => {
  const enabled =
    isOpen && edfiTenantId !== undefined && stepId !== undefined && runId !== undefined;
  const query = useQuery({
    queryKey: certificationQueryKeys.stepSnapshot(teamId, runId, stepId, ranAt),
    queryFn: () =>
      methods.getOne(
        `${certificationTenantUrl(teamId, edfiTenantId)}/runs/${runId}/step-runs/${stepId}/snapshot`,
        CertificationStepSnapshotDto,
      ),
    enabled,
  });

  // A disabled query reports isPending forever, so only count it when it can run.
  return {
    snapshot: enabled ? query.data : undefined,
    isPending: enabled && query.isPending,
    isError: enabled && query.isError,
  };
};
