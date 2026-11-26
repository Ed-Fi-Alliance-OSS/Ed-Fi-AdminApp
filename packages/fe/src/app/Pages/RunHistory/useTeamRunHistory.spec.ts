import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { useTeamRunHistory } from './useTeamRunHistory';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const mockUseQuery = useQuery as jest.Mock;

describe('useTeamRunHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keys the query by team and passes enabled through, so it does not fetch when disabled', () => {
    useTeamRunHistory(5, false);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      queryKey: [QUERY_KEYS.certification, 'run-history', 5],
      enabled: false,
    });
  });

  it('refetches on every mount and never on focus or reconnect', () => {
    useTeamRunHistory(5, true);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });

  it("fetches the team's runs", async () => {
    const rows = [{ runId: 9 }];
    (apiClient.get as jest.Mock).mockResolvedValue(rows);

    useTeamRunHistory(5, true);
    const options = mockUseQuery.mock.calls[0][0];

    await expect(options.queryFn()).resolves.toBe(rows);
    expect(apiClient.get).toHaveBeenCalledWith('teams/5/certification/runs');
  });
});
