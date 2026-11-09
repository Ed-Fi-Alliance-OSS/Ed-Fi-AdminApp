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

const CERT = 'team.sb-environment.edfi-tenant.ods.certification:read';
const SB_ENV_READ = 'team.sb-environment:read';
const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockAuthorize = authorize as jest.Mock;
const mockUsePrivilegeCacheForConfig = usePrivilegeCacheForConfig as jest.Mock;

const tenants = {
  a: { sbEnvironmentId: 1, edfiTenantId: 100, edfiTenantName: 'one' },
  b: { sbEnvironmentId: 1, edfiTenantId: 200, edfiTenantName: 'two' },
};

const setup = (opts: {
  data?: unknown;
  navLoading?: boolean;
  cacheLoading?: boolean;
  teamCacheLoading?: boolean;
  canReadEnvs?: boolean;
  grantedTenant?: number;
}) => {
  mockUseQuery.mockReturnValue({ data: opts.data, isLoading: opts.navLoading ?? false });
  // Called once with the team-level sb-environment:read config (not an array), then with the
  // per-tenant certification configs (an array).
  mockUsePrivilegeCacheForConfig.mockImplementation((config: unknown) =>
    Array.isArray(config)
      ? [{ isLoading: opts.cacheLoading ?? false }]
      : [{ isLoading: opts.teamCacheLoading ?? false }],
  );
  mockAuthorize.mockImplementation(
    ({ config }: { config: { privilege: string; subject: { edfiTenantId: number } } }) =>
      config.privilege === SB_ENV_READ
        ? opts.canReadEnvs ?? true
        : config.subject.edfiTenantId === opts.grantedTenant,
  );
};

describe('useCanSeeCertification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue({});
  });

  it('true when one of several tenants grants certification read', () => {
    setup({ data: tenants, grantedTenant: 200 });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: true, isLoading: false });
  });

  it('false when no tenant grants it', () => {
    setup({ data: tenants });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false });
  });

  it('false and not loading when the team has no tenants', () => {
    setup({ data: {} });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false });
  });

  it('false and not loading when the loaded team cache denies reading environments', () => {
    setup({ data: undefined, canReadEnvs: false });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: false });
    expect(teamQueries.navSearchList).toHaveBeenCalledWith({ enabled: false }, { teamId: 5 });
  });

  it('loading while the team privilege cache loads', () => {
    setup({ data: undefined, teamCacheLoading: true, canReadEnvs: false });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current).toEqual({ canSee: false, isLoading: true });
  });

  it('loading while the nav list loads', () => {
    setup({ data: undefined, navLoading: true });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current.isLoading).toBe(true);
  });

  it('loading while any privilege cache loads', () => {
    setup({ data: tenants, cacheLoading: true });
    const { result } = renderHook(() => useCanSeeCertification(5));
    expect(result.current.isLoading).toBe(true);
  });

  it('loads the certification privilege for every tenant', () => {
    setup({ data: tenants });
    renderHook(() => useCanSeeCertification(5));
    expect(mockUsePrivilegeCacheForConfig).toHaveBeenCalledWith([
      { privilege: CERT, subject: { id: '__filtered__', edfiTenantId: 100, teamId: 5 } },
      { privilege: CERT, subject: { id: '__filtered__', edfiTenantId: 200, teamId: 5 } },
    ]);
  });
});
