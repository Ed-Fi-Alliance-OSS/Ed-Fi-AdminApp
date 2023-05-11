import { UseQueryResult } from "@tanstack/react-query";

export const getEntityFromQuery = <
  R extends object
>(
  source: number | string | undefined,
  relations: UseQueryResult<Record<string | number, R>, unknown>
) =>
  source === undefined
    ? undefined
    : relations.data?.[source] || undefined;
