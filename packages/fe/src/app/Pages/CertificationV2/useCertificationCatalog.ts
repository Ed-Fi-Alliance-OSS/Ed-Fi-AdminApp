import {
  CertificationDomainDto,
  CertificationCatalogVersionDto,
  CertificationStepDto,
  certificationUnsupportedMessage,
  supportsCertification,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { methods, sbEnvironmentQueriesGlobal } from '../../api';
// Import the file directly: the api-v2 index pulls in its axios client.
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { byDisplayOrder, selectCatalogVersion, toDataStandardMajor } from './certificationCatalog';

const catalogUrl = (sbEnvironmentId: number) => `sb-environments/${sbEnvironmentId}/certification`;

/** Query keys for the certification catalog; invalidate `all(sbEnvironmentId)` after a catalog re-sync. */
export const certificationQueryKeys = {
  all: (sbEnvironmentId: number) => [QUERY_KEYS.certification, sbEnvironmentId] as const,
  catalogVersions: (sbEnvironmentId: number) =>
    [...certificationQueryKeys.all(sbEnvironmentId), 'catalog-versions'] as const,
  scenarios: (sbEnvironmentId: number, catalogVersionId: number | undefined) =>
    [...certificationQueryKeys.all(sbEnvironmentId), 'scenarios', catalogVersionId] as const,
  steps: (sbEnvironmentId: number, scenarioId: number | undefined) =>
    [...certificationQueryKeys.all(sbEnvironmentId), 'steps', scenarioId] as const,
  stepRuns: (
    sbEnvironmentId: number,
    edfiTenantId: number | undefined,
    odsId: number | undefined,
    scenarioId: number | undefined,
    runId: number | null | undefined,
  ) =>
    [
      ...certificationQueryKeys.all(sbEnvironmentId),
      'step-runs',
      edfiTenantId,
      odsId ?? null,
      scenarioId,
      runId,
    ] as const,
  scenarioStatuses: (
    sbEnvironmentId: number,
    edfiTenantId: number | undefined,
    odsId: number | undefined,
    sisVersion: string | undefined,
  ) =>
    [
      ...certificationQueryKeys.all(sbEnvironmentId),
      'scenario-statuses',
      edfiTenantId,
      odsId ?? null,
      sisVersion,
    ] as const,
  /** Includes the run identity and step execution time, so neither kind of re-run shares a snapshot. */
  stepSnapshot: (
    sbEnvironmentId: number,
    edfiTenantId: number | undefined,
    odsId: number | undefined,
    stepId: number | undefined,
    ranAt: string | undefined,
    runId: number | null | undefined,
  ) =>
    [
      ...certificationQueryKeys.all(sbEnvironmentId),
      'step-snapshot',
      edfiTenantId,
      odsId ?? null,
      stepId,
      ranAt,
      runId,
    ] as const,
};

/**
 * The certification domains (with their scenarios) for the catalog version that matches
 * the environment's data standard. For an environment that doesn't support certification,
 * nothing is requested (the API would refuse it) and `unsupportedMessage` says why.
 */
export const useCertificationCatalog = (sbEnvironmentId: number) => {
  const sbEnvironmentQuery = useQuery(sbEnvironmentQueriesGlobal.getOne({ id: sbEnvironmentId }));
  const odsDsVersion = sbEnvironmentQuery.data?.odsDsVersion;
  const dataStandardVersion = toDataStandardMajor(odsDsVersion);
  const isSupported = sbEnvironmentQuery.data !== undefined && supportsCertification(odsDsVersion);
  const unsupportedMessage =
    sbEnvironmentQuery.data !== undefined && !isSupported
      ? certificationUnsupportedMessage(odsDsVersion)
      : undefined;

  const catalogVersionsQuery = useQuery({
    queryKey: certificationQueryKeys.catalogVersions(sbEnvironmentId),
    queryFn: () =>
      methods.getMany(
        `${catalogUrl(sbEnvironmentId)}/catalog-versions`,
        CertificationCatalogVersionDto,
      ),
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
    queryKey: certificationQueryKeys.scenarios(sbEnvironmentId, catalogVersionId),
    queryFn: () =>
      methods.getMany(`${catalogUrl(sbEnvironmentId)}/scenarios`, CertificationDomainDto, {
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
    sbEnvironmentQuery.isPending ||
    (isSupported && catalogVersionsQuery.isPending) ||
    (catalogVersionId !== undefined && domainsQuery.isPending);

  // isSupported is false until the environment loads; unsupportedMessage only once it has.
  return { dataStandardVersion, isSupported, unsupportedMessage, catalogVersion, domains, isPending };
};

/** The steps (with their parameters) of one scenario, in display order. */
export const useCertificationSteps = (sbEnvironmentId: number, scenarioId: number | undefined) => {
  const stepsQuery = useQuery({
    queryKey: certificationQueryKeys.steps(sbEnvironmentId, scenarioId),
    queryFn: () =>
      methods.getMany(`${catalogUrl(sbEnvironmentId)}/steps`, CertificationStepDto, {
        params: { scenarioId },
      }),
    enabled: scenarioId !== undefined,
    throwOnError: true,
  });
  const steps = useMemo(() => byDisplayOrder(stepsQuery.data ?? []), [stepsQuery.data]);
  return { steps, isPending: scenarioId !== undefined && stepsQuery.isPending };
};
