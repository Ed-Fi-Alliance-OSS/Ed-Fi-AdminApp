import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { useTeamCertificationDashboard } from './useTeamCertificationDashboard';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const mockUseQuery = useQuery as jest.Mock;

describe('useTeamCertificationDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keys the query by team and passes enabled through', () => {
    useTeamCertificationDashboard(7, false);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      queryKey: [QUERY_KEYS.certification, 'team-dashboard', 7],
      enabled: false,
    });
  });

  it('is a page-load snapshot: refetches on every mount and never on focus or reconnect', () => {
    useTeamCertificationDashboard(7, true);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });

  it('fetches the team dashboard', async () => {
    const dashboard = { counts: {}, dataStores: [] };
    (apiClient.get as jest.Mock).mockResolvedValue(dashboard);

    useTeamCertificationDashboard(7, true);
    const options = mockUseQuery.mock.calls[0][0];

    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toBe(dashboard);
    expect(apiClient.get).toHaveBeenCalledWith('teams/7/certification/dashboard');
  });
});
