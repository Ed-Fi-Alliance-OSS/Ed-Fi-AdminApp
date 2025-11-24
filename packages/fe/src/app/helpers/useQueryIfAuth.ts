import {
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '.';

export const useQueryIfAuth = <
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  queryConfig: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  authConfig: AuthorizeConfig | undefined
): UseQueryResult<TData, TError> => {
  const queryClient = useQueryClient();
  usePrivilegeCacheForConfig(authConfig);
  const isAuthd = authorize({ config: authConfig, queryClient });
  return useQuery({
    ...queryConfig,
    enabled: isAuthd && queryConfig?.enabled !== false,
  });
};
