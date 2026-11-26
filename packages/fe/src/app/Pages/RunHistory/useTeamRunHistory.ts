import { CertificationRunHistoryRowDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';

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
