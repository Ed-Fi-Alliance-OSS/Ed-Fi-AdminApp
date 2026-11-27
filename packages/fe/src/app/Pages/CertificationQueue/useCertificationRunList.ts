import { CertificationDashboardListDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';

export const CERTIFICATION_RUN_LIST_QUERY_KEY = [QUERY_KEYS.certification, 'runs'];

/** Every certification run, a snapshot of page load: refetched on each mount, never on focus. */
export const useCertificationRunList = (enabled: boolean) =>
  useQuery({
    queryKey: CERTIFICATION_RUN_LIST_QUERY_KEY,
    queryFn: async () =>
      (await apiClient.get('certification/runs')) as unknown as CertificationDashboardListDto,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
