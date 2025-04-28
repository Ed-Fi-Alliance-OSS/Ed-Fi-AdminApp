import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryKey?: string[];
};

export function useGetManyIntegrationProviders({ queryKey, ...rest }: Props) {
  return useQuery({
    queryKey: queryKey ?? [QUERY_KEYS.integrationProviders],
    queryFn: async () => {
      const response = await apiClient.get(`integration-providers`);
      return response;
    },
    ...rest,
  }) as UseQueryResult<GetIntegrationProviderDto[]>;
}
