import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';
import { useNavContext } from '../helpers';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs?: {
    asTeam?: boolean;
  };
  queryKey?: string[];
};

export function useGetManyIntegrationProviders({ queryArgs, queryKey, ...rest }: Props) {
  const { asId: teamId } = useNavContext();

  const { asTeam } = queryArgs ?? { asTeam: true };
  const asTeamKey = asTeam && teamId ? [QUERY_KEYS.asTeam, teamId] : [];

  return useQuery({
    queryKey: queryKey ?? [...asTeamKey, QUERY_KEYS.integrationProviders],
    queryFn: async () => {
      if (asTeam && teamId) {
        return await apiClient.get(`teams/${teamId}/integration-providers`);
      }

      const response = await apiClient.get('integration-providers');
      return response;
    },
    throwOnError: true,
    ...rest,
  }) as UseQueryResult<GetIntegrationProviderDto[]>;
}
