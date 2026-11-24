import { CertificationRunHistoryRowDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';

/**
 * The team's Run history: every run it started on a data store the user can read, newest first,
 * with scenario progress. Like My products, it is a snapshot of page load: fetched on every
 * mount and not refetched while the page is open.
 */
export const useTeamRunHistory = (teamId: number, enabled: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.certification, 'run-history', teamId],
    queryFn: async () =>
      (await apiClient.get(
        `teams/${teamId}/certification/runs`
      )) as unknown as CertificationRunHistoryRowDto[],
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
