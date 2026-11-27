import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { CERTIFICATION_RUN_LIST_QUERY_KEY, useCertificationRunList } from './useCertificationRunList';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const mockUseQuery = useQuery as jest.Mock;

describe('useCertificationRunList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keys the query under certification/runs', () => {
    expect(CERTIFICATION_RUN_LIST_QUERY_KEY).toEqual([QUERY_KEYS.certification, 'runs']);
  });

  it('does not fetch when disabled', () => {
    useCertificationRunList(false);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      queryKey: CERTIFICATION_RUN_LIST_QUERY_KEY,
      enabled: false,
    });
  });

  it('refetches on every mount and never on focus or reconnect', () => {
    useCertificationRunList(true);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });

  it('fetches certification/runs when enabled', async () => {
    const list = { rows: [], total: 0 };
    (apiClient.get as jest.Mock).mockResolvedValue(list);

    useCertificationRunList(true);

    await expect(mockUseQuery.mock.calls[0][0].queryFn()).resolves.toBe(list);
    expect(apiClient.get).toHaveBeenCalledWith('certification/runs');
  });
});
