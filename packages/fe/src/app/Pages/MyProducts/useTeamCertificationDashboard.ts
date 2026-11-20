import { CertificationTeamDashboardDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';

/**
 * One request for the whole My products dashboard: counts and data store cards. It is a snapshot
 * of page load: fetched on every mount (ignoring the app-wide stale time) and not refetched while
 * the page is open.
 */
export const useTeamCertificationDashboard = (teamId: number, enabled: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.certification, 'team-dashboard', teamId],
    queryFn: async () =>
      (await apiClient.get(
        `teams/${teamId}/certification/dashboard`
      )) as unknown as CertificationTeamDashboardDto,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
