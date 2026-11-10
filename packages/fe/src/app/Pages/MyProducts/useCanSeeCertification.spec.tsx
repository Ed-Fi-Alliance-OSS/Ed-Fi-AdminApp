import { renderHook } from '@testing-library/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teamQueries } from '../../api';
import { authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { useCanSeeCertification } from './useCanSeeCertification';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({})),
}));

jest.mock('../../api', () => ({
  teamQueries: { navSearchList: jest.fn(() => ({ queryKey: ['nav-search-key'] })) },
}));

jest.mock('../../helpers', () => ({
  authorize: jest.fn(() => false),
  usePrivilegeCacheForConfig: jest.fn(() => []),
}));

const SB_ENV_READ = 'team.sb-environment:read';
const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockAuthorize = authorize as jest.Mock;
const mockUsePrivilegeCacheForConfig = usePrivilegeCacheForConfig as jest.Mock;

const tenants = (grantedTenant?: number) => ({
  a: { sbEnvironmentId: 1, edfiTenantId: 100, certifications: grantedTenant === 100 },
  b: { sbEnvironmentId: 1, edfiTenantId: 200, certifications: grantedTenant === 200 },
});

const setup = (opts: {
  data?: unknown;
  navLoading?: boolean;
  navError?: Error;
  teamCacheLoading?: boolean;
  canReadEnvs?: boolean;
}) => {
  mockUseQuery.mockReturnValue({
    data: opts.data,
    isLoading: opts.navLoading ?? false,
    error: opts.navError ?? null,
  });
  mockUsePrivilegeCacheForConfig.mockReturnValue([{ isLoading: opts.teamCacheLoading ?? false }]);
  mockAuthorize.mockImplementation(
    ({ config }: { config: { privilege: string } }) =>
      config.privilege === SB_ENV_READ && (opts.canReadEnvs ?? true),
  );
};

describe('useCanSeeCertification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue({});
  });

  it('true when one of several tenants grants certification read', () => {
    setup({ data: tenants(200) });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: true, isLoading: false, error: null });
  });

  it('false when no tenant grants it', () => {
    setup({ data: tenants() });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false, error: null });
  });

  it('false and not loading when the team has no tenants', () => {
    setup({ data: {} });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false, error: null });
  });

  it('false and not loading when the loaded team cache denies reading environments', () => {
    setup({ data: undefined, canReadEnvs: false });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false, error: null });
    expect(teamQueries.navSearchList).toHaveBeenCalledWith({ enabled: false }, { teamId: 5 });
  });

  it('loading while the team privilege cache loads', () => {
    setup({ data: undefined, teamCacheLoading: true, canReadEnvs: false });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: true, error: null });
  });

  it('reports the env-nav error instead of a plain denial when the request fails', () => {
    const navError = new Error('Request failed with status code 500');
    setup({ data: undefined, navError });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false, error: navError });
  });

  it('loading while the nav list loads', () => {
    setup({ data: undefined, navLoading: true });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current.isLoading).toBe(true);
  });

  it('loads only the team-level privilege cache, never one per tenant', () => {
    setup({ data: tenants(100) });
    renderHook(() => useCanSeeCertification(5));
    expect(mockUsePrivilegeCacheForConfig).toHaveBeenCalledTimes(1);
    expect(mockUsePrivilegeCacheForConfig).toHaveBeenCalledWith({
      privilege: SB_ENV_READ,
      subject: { id: '__filtered__', teamId: 5 },
    });
  });
});
