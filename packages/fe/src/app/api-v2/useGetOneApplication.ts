import { type UseQueryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { GetIntegrationAppDto, GetApplicationDtoV2 } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

type Props = Omit<UseQueryOptions, 'queryKey'> & {
  queryArgs?: {
    applicationId: number;
    edfiTenantId?: number;
    getIntegrationAppDetails?: boolean;
    teamId?: number;
  };
  queryKey?: string[];
};

export function useGetOneApplication({ queryArgs, queryKey, ...rest }: Props) {
  const { applicationId, edfiTenantId, getIntegrationAppDetails, teamId } = queryArgs ?? {};

  return useQuery({
    queryKey: queryKey ?? [
      QUERY_KEYS.edfiTenants,
      edfiTenantId,
      QUERY_KEYS.applications,
      applicationId,
      { getIntegrationAppDetails },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (getIntegrationAppDetails !== undefined)
        params.append('getIntegrationAppDetails', getIntegrationAppDetails.toString());

      const response = await apiClient.get(
        `teams/${teamId}/edfi-tenants/${edfiTenantId}/admin-api/v2/applications/${applicationId}?${params}`
      );
      return response;
    },
    throwOnError: true,
    ...rest,
  }) as UseQueryResult<GetApplicationDtoV2 & GetIntegrationAppDto>;
}
