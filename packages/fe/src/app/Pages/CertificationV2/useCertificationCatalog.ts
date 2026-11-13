import {
  CertificationDomainDto,
  CertificationCatalogVersionDto,
  CertificationStepDto,
  certificationUnsupportedMessage,
  supportsCertification,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { methods, sbEnvironmentQueries } from '../../api';
// Import the file directly: the api-v2 index pulls in its axios client.
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { byDisplayOrder, selectCatalogVersion, toDataStandardMajor } from './certificationCatalog';

/** The base URL of the certification routes of one of the team's tenants (AC-651). */
export const certificationTenantUrl = (teamId: number, edfiTenantId: number | undefined) =>
  `teams/${teamId}/edfi-tenants/${edfiTenantId}/certification`;

/**
 * Query keys for the team's certification data; invalidate `all(teamId)` after anything that
 * changes a run. Results are keyed by run, so one run's results never show under another.
 */
export const certificationQueryKeys = {
  all: (teamId: number) => [QUERY_KEYS.certification, teamId] as const,
  catalogVersions: (teamId: number, edfiTenantId: number | undefined) =>
    [...certificationQueryKeys.all(teamId), 'catalog-versions', edfiTenantId] as const,
  scenarios: (
    teamId: number,
    edfiTenantId: number | undefined,
    catalogVersionId: number | undefined,
  ) =>
    [...certificationQueryKeys.all(teamId), 'scenarios', edfiTenantId, catalogVersionId] as const,
  steps: (teamId: number, edfiTenantId: number | undefined, scenarioId: number | undefined) =>
    [...certificationQueryKeys.all(teamId), 'steps', edfiTenantId, scenarioId] as const,
  run: (teamId: number, runId: number | undefined) =>
    [...certificationQueryKeys.all(teamId), 'run', runId] as const,
  latestRuns: (teamId: number, edfiTenantId: number | undefined, odsId: number | undefined) =>
    [...certificationQueryKeys.all(teamId), 'latest-runs', edfiTenantId, odsId] as const,
  stepRuns: (teamId: number, runId: number | undefined, scenarioId: number | undefined) =>
    [...certificationQueryKeys.all(teamId), 'step-runs', runId, scenarioId] as const,
  scenarioStatuses: (teamId: number, runId: number | undefined) =>
    [...certificationQueryKeys.all(teamId), 'scenario-statuses', runId] as const,
  /** Includes the step execution time, so a re-run never shares a snapshot. */
  stepSnapshot: (
    teamId: number,
    runId: number | undefined,
    stepId: number | undefined,
    ranAt: string | undefined,
  ) => [...certificationQueryKeys.all(teamId), 'step-snapshot', runId, stepId, ranAt] as const,
};

type UseCertificationCatalogArgs = {
  teamId: number;
  /** The run's environment and tenant; undefined until the run has loaded. */
  sbEnvironmentId: number | undefined;
  edfiTenantId: number | undefined;
  /**
   * The data standard the run was started with (`v5`). The server runs steps from the run's own
   * catalog, so it wins over the environment's current version, which can change while a run is open.
   */
  runDataStandardVersion?: string | null;
};

/**
 * The certification domains (with their scenarios) for the run's catalog version, which is the
 * one matching the environment's data standard when the run was started. For an environment that
 * doesn't support certification, nothing is requested (the API would refuse it) and
 * `unsupportedMessage` says why.
 */
export const useCertificationCatalog = ({
  teamId,
  sbEnvironmentId,
  edfiTenantId,
  runDataStandardVersion,
}: UseCertificationCatalogArgs) => {
  const hasTarget = sbEnvironmentId !== undefined && edfiTenantId !== undefined;
  const sbEnvironmentQuery = useQuery(
    sbEnvironmentQueries.getOne({ id: sbEnvironmentId as number, teamId, enabled: hasTarget }),
  );
  const sbEnvironment = hasTarget ? sbEnvironmentQuery.data : undefined;
  const odsDsVersion = sbEnvironment?.odsDsVersion;
  const dataStandardVersion = runDataStandardVersion ?? toDataStandardMajor(odsDsVersion);
  const isSupported = sbEnvironment !== undefined && supportsCertification(odsDsVersion);
  const unsupportedMessage =
    sbEnvironment !== undefined && !isSupported
      ? certificationUnsupportedMessage(odsDsVersion)
      : undefined;
  const baseUrl = certificationTenantUrl(teamId, edfiTenantId);

  const catalogVersionsQuery = useQuery({
    queryKey: certificationQueryKeys.catalogVersions(teamId, edfiTenantId),
    queryFn: () => methods.getMany(`${baseUrl}/catalog-versions`, CertificationCatalogVersionDto),
    enabled: isSupported,
    throwOnError: true,
  });
  // A disabled query keeps its cached data, so a list cached while the environment was
  // supported must not select a catalog now.
  const catalogVersion = useMemo(
    () =>
      isSupported
        ? selectCatalogVersion(catalogVersionsQuery.data ?? [], dataStandardVersion)
        : undefined,
    [isSupported, catalogVersionsQuery.data, dataStandardVersion],
  );
  const catalogVersionId = catalogVersion?.catalogVersionId;

  const domainsQuery = useQuery({
    queryKey: certificationQueryKeys.scenarios(teamId, edfiTenantId, catalogVersionId),
    queryFn: () =>
      methods.getMany(`${baseUrl}/scenarios`, CertificationDomainDto, {
        params: { catalogVersionId },
      }),
    enabled: catalogVersionId !== undefined,
    throwOnError: true,
  });
  const domains = useMemo(
    () =>
      byDisplayOrder(domainsQuery.data ?? []).map((domain) => ({
        ...domain,
        scenarios: byDisplayOrder(domain.scenarios ?? []),
      })),
    [domainsQuery.data],
  );

  // A disabled query reports isPending forever, so only count each query when it can run.
  const isPending =
    !hasTarget ||
    sbEnvironmentQuery.isPending ||
    (isSupported && catalogVersionsQuery.isPending) ||
    (catalogVersionId !== undefined && domainsQuery.isPending);

  // isSupported is false until the environment loads; unsupportedMessage only once it has.
  return {
    sbEnvironment,
    dataStandardVersion,
    isSupported,
    unsupportedMessage,
    catalogVersion,
    domains,
    isPending,
  };
};

/** The steps (with their parameters) of one scenario, in display order. */
export const useCertificationSteps = ({
  teamId,
  edfiTenantId,
  scenarioId,
}: {
  teamId: number;
  edfiTenantId: number | undefined;
  scenarioId: number | undefined;
}) => {
  const enabled = edfiTenantId !== undefined && scenarioId !== undefined;
  const stepsQuery = useQuery({
    queryKey: certificationQueryKeys.steps(teamId, edfiTenantId, scenarioId),
    queryFn: () =>
      methods.getMany(
        `${certificationTenantUrl(teamId, edfiTenantId)}/steps`,
        CertificationStepDto,
        { params: { scenarioId } },
      ),
    enabled,
    throwOnError: true,
  });
  const steps = useMemo(() => byDisplayOrder(stepsQuery.data ?? []), [stepsQuery.data]);
  return { steps, isPending: enabled && stepsQuery.isPending };
};
