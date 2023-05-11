import { UseQueryResult } from '@tanstack/react-query';

export const getRelationDisplayName = <
  R extends { displayName?: string | number }
>(
  source: string | number | undefined,
  relations: Pick<UseQueryResult<Record<string | number, R>, unknown>, 'data'>
) =>
  source === undefined
    ? undefined
    : relations.data?.[source]?.displayName || source;
