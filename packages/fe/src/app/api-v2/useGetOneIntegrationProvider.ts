import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs: {
    id: string | number;
  };
  queryKey?: string[];
};

export function useGetOneIntegrationProvider({ queryArgs, queryKey, ...rest }: Props) {
  const { id } = queryArgs;
  return useQuery({
    queryKey: queryKey ?? [QUERY_KEYS.integrationProviders, Number(id)],
    queryFn: async () => {
      const response = await apiClient.get(`integration-providers?id=${id}`);
      return response;
    },
    ...rest,
  }) as UseQueryResult<GetIntegrationProviderDto>;
}
