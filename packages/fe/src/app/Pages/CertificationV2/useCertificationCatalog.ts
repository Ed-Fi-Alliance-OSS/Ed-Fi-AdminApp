import {
  CertificationAreaDto,
  CertificationCatalogVersionDto,
  CertificationStepDto,
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
};

/**
 * The certification areas (with their scenarios) for the catalog version that matches
 * the environment's data standard.
 */
export const useCertificationCatalog = (sbEnvironmentId: number) => {
  const sbEnvironmentQuery = useQuery(sbEnvironmentQueriesGlobal.getOne({ id: sbEnvironmentId }));
  const dataStandardVersion = toDataStandardMajor(sbEnvironmentQuery.data?.odsDsVersion);

  const catalogVersionsQuery = useQuery({
    queryKey: certificationQueryKeys.catalogVersions(sbEnvironmentId),
    queryFn: () =>
      methods.getMany(
        `${catalogUrl(sbEnvironmentId)}/catalog-versions`,
        CertificationCatalogVersionDto,
      ),
    throwOnError: true,
  });
  const catalogVersion = useMemo(
    () => selectCatalogVersion(catalogVersionsQuery.data ?? [], dataStandardVersion),
    [catalogVersionsQuery.data, dataStandardVersion],
  );
  const catalogVersionId = catalogVersion?.catalogVersionId;

  const areasQuery = useQuery({
    queryKey: certificationQueryKeys.scenarios(sbEnvironmentId, catalogVersionId),
    queryFn: () =>
      methods.getMany(`${catalogUrl(sbEnvironmentId)}/scenarios`, CertificationAreaDto, {
        params: { catalogVersionId },
      }),
    enabled: catalogVersionId !== undefined,
    throwOnError: true,
  });
  const areas = useMemo(
    () =>
      byDisplayOrder(areasQuery.data ?? []).map((area) => ({
        ...area,
        scenarios: byDisplayOrder(area.scenarios ?? []),
      })),
    [areasQuery.data],
  );

  // A disabled query reports isPending forever, so only count the areas query when it can run.
  const isPending =
    sbEnvironmentQuery.isPending ||
    catalogVersionsQuery.isPending ||
    (catalogVersionId !== undefined && areasQuery.isPending);

  return { dataStandardVersion, catalogVersion, areas, isPending };
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
