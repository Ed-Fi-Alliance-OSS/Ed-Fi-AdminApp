import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const toId = (value: string | null) => {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * The scenario choice, kept in the query string so a refresh keeps it (AC-673). The tenant
 * and data store used to be here too; since AC-651 the run in the address fixes them.
 */
export const useCertificationSelection = () => {
  const [searchParams] = useSearchParams();
  const scenarioId = toId(searchParams.get('scenarioId'));

  const toSearch = useCallback(
    (extra: { scenarioId?: number } = {}) => {
      const scenario = extra.scenarioId ?? scenarioId;
      return scenario === undefined ? '' : `?scenarioId=${scenario}`;
    },
    [scenarioId],
  );

  return { scenarioId, toSearch };
};
