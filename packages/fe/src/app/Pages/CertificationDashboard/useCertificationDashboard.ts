import { CertificationDashboardDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';

/**
 * One request for the whole dashboard: counts and both lists. It is a snapshot of page load:
 * fetched on every mount (ignoring the app-wide stale time) and not refetched while the page is open.
 */
export const useCertificationDashboard = (enabled: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.certification, 'dashboard'],
    queryFn: async () =>
      (await apiClient.get('certification/dashboard')) as unknown as CertificationDashboardDto,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
