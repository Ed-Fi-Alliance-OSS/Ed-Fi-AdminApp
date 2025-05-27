import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationAppDto, GetApplicationDtoV2 } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs?: {
    edfiTenantId?: number;
    integrationProviderId?: number;
    teamId?: number;
  };
  queryKey?: string[];
};

export function useGetManyApplications({ queryArgs, queryKey, ...rest }: Props) {
  const { edfiTenantId, integrationProviderId, teamId } = queryArgs ?? {};
  return useQuery({
    queryKey: queryKey ?? [
      QUERY_KEYS.team,
      teamId,
      QUERY_KEYS.edfiTenants,
      edfiTenantId,
      QUERY_KEYS.applications,
      { integrationProviderId },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (integrationProviderId)
        params.append('integrationProviderId', integrationProviderId.toString());

      const response = await apiClient.get(
        `teams/${teamId}/edfi-tenants/${edfiTenantId}/admin-api/v2/applications?${params}`
      );
      return response;
    },
    ...rest,
  }) as UseQueryResult<(GetApplicationDtoV2 & GetIntegrationAppDto)[]>;
}
