import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { CertificationScenarioStatusDto } from '@edanalytics/models';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';
import { useCertificationScenarioStatuses } from './useCertificationScenarioStatuses';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../api', () => ({ methods: { getMany: jest.fn() } }));

type QueryOptions = {
  queryKey: unknown[];
  enabled?: boolean;
  refetchOnMount?: unknown;
  queryFn: () => unknown;
  throwOnError: (error: unknown, query: { state: { data: unknown } }) => boolean;
};

const args = {
  sbEnvironmentId: 1,
  edfiTenantId: 10,
  odsId: 5 as number | undefined,
  sisVersion: 'v5' as string | undefined,
  enabled: true,
};

const render = (
  overrides: Partial<typeof args> = {},
  state: { data?: unknown; isPending: boolean } = { isPending: true },
) => {
  (useQuery as jest.Mock).mockReturnValue(state);
  const { result } = renderHook(() => useCertificationScenarioStatuses({ ...args, ...overrides }));
  const options = (useQuery as jest.Mock).mock.calls.at(-1)[0] as QueryOptions;
  return { result: result.current, options };
};

describe('useCertificationScenarioStatuses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the scenario-statuses route, omitting odsId when no ODS is chosen', async () => {
    const { options } = render({ odsId: undefined });
    await options.queryFn();

    expect(methods.getMany).toHaveBeenCalledWith(
      'sb-environments/1/edfi-tenants/10/certification/sis/v5/scenario-statuses',
      CertificationScenarioStatusDto,
      { params: {} },
    );
    expect(options.queryKey).toEqual(certificationQueryKeys.scenarioStatuses(1, 10, undefined));
    expect(options.queryKey).toEqual(['certification', 1, 'scenario-statuses', 10, null]);
  });

  it('sends odsId when an ODS is chosen', async () => {
    const { options } = render();
    await options.queryFn();

    expect(methods.getMany).toHaveBeenCalledWith(
      expect.any(String),
      CertificationScenarioStatusDto,
      {
        params: { odsId: 5 },
      },
    );
  });

  it('always refetches on mount so a saved run elsewhere is reflected', () => {
    expect(render().options.refetchOnMount).toBe('always');
  });

  it.each([
    ['disabled by the caller', { enabled: false }],
    ['missing a tenant', { edfiTenantId: undefined }],
    ['missing a sis version', { sisVersion: undefined }],
  ])('is disabled when %s', (_label, overrides) => {
    const { options, result } = render(overrides);
    expect(options.enabled).toBe(false);
    expect(result.isPending).toBe(false);
  });

  it('is enabled once the caller enables it with a tenant and version known', () => {
    expect(render().options.enabled).toBe(true);
  });

  it('indexes the statuses by scenarioId', () => {
    const { result } = render(
      {},
      {
        data: [
          { scenarioId: 52, status: 'completed' },
          { scenarioId: 51, status: 'failed' },
        ],
        isPending: false,
      },
    );

    expect(result.statusByScenarioId).toEqual({ 52: 'completed', 51: 'failed' });
    expect(result.isPending).toBe(false);
  });

  it('has no statuses while loading', () => {
    const { result } = render();
    expect(result.statusByScenarioId).toEqual({});
    expect(result.isPending).toBe(true);
  });

  it('sends a failed first load to the error page', () => {
    const { options } = render();
    expect(options.throwOnError(new Error('x'), { state: { data: undefined } })).toBe(true);
  });

  it('keeps the page and its statuses when a later refetch fails', () => {
    const { options } = render();
    expect(options.throwOnError(new Error('x'), { state: { data: [] } })).toBe(false);
  });
});
