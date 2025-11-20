import { UseQueryResult } from '@tanstack/react-query';

export const getRelationDisplayName = <R extends { displayName?: string | number }>(
  source: string | number | undefined | null,
  relations: Pick<UseQueryResult<Record<string | number, R>, unknown>, 'data'>
) =>
  source === undefined || source === null ? '-' : relations.data?.[source]?.displayName || source;
