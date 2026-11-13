import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { useCertificationDashboard } from './useCertificationDashboard';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const mockUseQuery = useQuery as jest.Mock;

describe('useCertificationDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not fetch when disabled', () => {
    useCertificationDashboard(false);
    expect(mockUseQuery.mock.calls[0][0]).toMatchObject({
      queryKey: [QUERY_KEYS.certification, 'dashboard'],
      enabled: false,
    });
  });

  it('fetches certification/dashboard when enabled', async () => {
    const dashboard = {
      counts: {},
      waiting: { rows: [], total: 0 },
      others: { rows: [], total: 0 },
    };
    (apiClient.get as jest.Mock).mockResolvedValue(dashboard);

    useCertificationDashboard(true);
    const options = mockUseQuery.mock.calls[0][0];

    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toBe(dashboard);
    expect(apiClient.get).toHaveBeenCalledWith('certification/dashboard');
  });
});
