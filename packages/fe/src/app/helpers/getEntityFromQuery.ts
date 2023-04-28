import { UseQueryResult } from "@tanstack/react-query";

export const getEntityFromQuery = <
  R extends { displayName?: string | number }
>(
  source: number | undefined,
  relations: UseQueryResult<Record<string | number, R>, unknown>
) =>
  source === undefined
    ? undefined
    : relations.data?.[source] || undefined;
