import 'reflect-metadata';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { apiClient } from '../../api/methods';
import { useCanSeeCertification } from './useCanSeeCertification';

// builder.ts imports the ESM-only 'kebab-case' package that Jest's Babel transform can't parse.
jest.mock('kebab-case', () => (str: string) => str);

// Avoids config.ts's `import.meta.env`, which Jest can't parse.
jest.mock('../../../config/config', () => ({
  config: { apiUrl: '/api', oidcId: '1', basePath: '/' },
}));

// The real privilege-cache helpers, without the rest of the helpers barrel (react-router is ESM).
jest.mock('../../helpers', () => jest.requireActual('../../helpers/Authorize'));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const navItem = (edfiTenantId: number, certifications: boolean) => ({
  sbEnvironmentId: 1,
  sbEnvironmentName: 'env',
  edfiTenantId,
  edfiTenantName: `tenant-${edfiTenantId}`,
  certifications,
});

const renderCold = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCanSeeCertification(5), { wrapper });
};

describe('useCanSeeCertification cold load (real QueryClient)', () => {
  let getSpy: jest.SpyInstance;

  afterEach(() => getSpy.mockRestore());

  it('stays loading until the team cache and nav list resolve, then grants from one tenant', async () => {
    const teamCache = deferred<unknown>();
    // The response interceptor unwraps `res.data`; spying on get bypasses it, so return payloads.
    getSpy = jest.spyOn(apiClient, 'get').mockImplementation(((url: string) => {
      if (url === '/auth/cache/5') return teamCache.promise;
      if (url === '/teams/5/env-nav')
        return Promise.resolve([navItem(100, false), navItem(200, true)]);
      return Promise.reject(new Error(`unexpected GET ${url}`));
    }) as unknown as typeof apiClient.get);

    const { result } = renderCold();

    // First render: the team privilege cache has not arrived yet.
    expect(result.current).toEqual({ canSee: false, isLoading: true });

    await act(async () => teamCache.resolve({ 'team.sb-environment:read': true }));

    await waitFor(() => expect(result.current).toEqual({ canSee: true, isLoading: false }));
    expect(getSpy).toHaveBeenCalledWith('/teams/5/env-nav', undefined);
    // No per-tenant privilege-cache requests.
    expect(getSpy.mock.calls.map(([url]) => url)).not.toContainEqual(
      expect.stringContaining('edfiTenantId='),
    );
  });

  it('resolves to not allowed when the loaded team cache denies environment read', async () => {
    getSpy = jest.spyOn(apiClient, 'get').mockImplementation(((url: string) => {
      if (url === '/auth/cache/5') return Promise.resolve({});
      return Promise.reject(new Error(`unexpected GET ${url}`));
    }) as unknown as typeof apiClient.get);

    const { result } = renderCold();

    expect(result.current).toEqual({ canSee: false, isLoading: true });
    await waitFor(() => expect(result.current).toEqual({ canSee: false, isLoading: false }));
    expect(getSpy).not.toHaveBeenCalledWith('/teams/5/env-nav', undefined);
  });
});
