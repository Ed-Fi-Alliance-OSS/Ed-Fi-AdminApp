import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationAppDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';
import { useNavContext } from '../helpers';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs: {
    integrationProviderId: number;
  };
  queryKey?: string[];
};

export function useGetManyIntegrationApps({ queryArgs, queryKey, ...rest }: Props) {
  const { asId: teamId } = useNavContext();
  const asTeamKey = teamId ? [QUERY_KEYS.asTeam, teamId] : [];
  const { integrationProviderId } = queryArgs;

  return useQuery({
    queryKey: queryKey ?? [
      QUERY_KEYS.integrationProviders,
      integrationProviderId,
      QUERY_KEYS.integrationApps,
      ...asTeamKey,
    ],
    queryFn: async () => {
      const response = await apiClient.get(
        `teams/${teamId}/integration-providers/${integrationProviderId}/integration-apps`
      );
      return response;
    },
    ...rest,
  }) as UseQueryResult<GetIntegrationAppDto[]>;
}
