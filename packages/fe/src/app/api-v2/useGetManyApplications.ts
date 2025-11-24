import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationAppDto, GetApplicationDtoV2 } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs?: {
    edfiTenantId?: number;
    teamId?: number;
  };
  queryKey?: string[];
};

export function useGetManyApplications({ queryArgs, queryKey, ...rest }: Props) {
  const { edfiTenantId, teamId } = queryArgs ?? {};
  const asTeamKey = teamId ? [QUERY_KEYS.asTeam, teamId] : [];

  return useQuery({
    queryKey: queryKey ?? [
      QUERY_KEYS.edfiTenants,
      edfiTenantId,
      QUERY_KEYS.applications,
      ...asTeamKey,
    ],
    queryFn: async () => {
      const response = await apiClient.get(
        `teams/${teamId}/edfi-tenants/${edfiTenantId}/admin-api/v2/applications`
      );
      return response;
    },
    throwOnError: true,
    ...rest,
  }) as UseQueryResult<(GetApplicationDtoV2 & GetIntegrationAppDto)[]>;
}
