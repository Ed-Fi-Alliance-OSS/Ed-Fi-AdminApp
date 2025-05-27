import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';
import { useNavContext } from '../helpers';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs: {
    integrationProviderId: string | number;
  };
  queryKey?: string[];
};

export function useGetOneIntegrationProvider({ queryArgs, queryKey, ...rest }: Props) {
  const { asId: teamId } = useNavContext();

  const { integrationProviderId } = queryArgs;
  return useQuery({
    queryKey: queryKey ?? [QUERY_KEYS.integrationProviders, Number(integrationProviderId)],
    queryFn: async () => {
      if (teamId) {
        return await apiClient.get(
          `teams/${teamId}/integration-providers/${integrationProviderId}`
        );
      }

      const response = await apiClient.get(`integration-providers?id=${integrationProviderId}`);
      return response;
    },
    throwOnError: true,
    ...rest,
  }) as UseQueryResult<GetIntegrationProviderDto>;
}
