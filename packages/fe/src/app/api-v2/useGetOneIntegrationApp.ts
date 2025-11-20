import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationAppDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';
import { useNavContext } from '../helpers';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs: {
    integrationProviderId: string | number;
    integrationAppId: string | number;
  };
  queryKey?: string[];
};

export function useGetOneIntegrationApp({ queryArgs, queryKey, ...rest }: Props) {
  const { asId: teamId } = useNavContext();
  const { integrationAppId, integrationProviderId } = queryArgs;

  return useQuery({
    queryKey: queryKey ?? [
      QUERY_KEYS.integrationProviders,
      integrationProviderId,
      QUERY_KEYS.integrationApps,
      integrationAppId,
    ],
    queryFn: async () => {
      const response = await apiClient.get(
        `teams/${teamId}/integration-providers/${integrationProviderId}/integration-apps/${integrationAppId}`
      );
      return response;
    },
    throwOnError: true,
    ...rest,
  }) as UseQueryResult<GetIntegrationAppDto>;
}
