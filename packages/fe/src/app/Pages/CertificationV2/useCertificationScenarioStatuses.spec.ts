import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { CertificationScenarioStatusesDto } from '@edanalytics/models';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';
import { useCertificationScenarioStatuses } from './useCertificationScenarioStatuses';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../api', () => ({ methods: { getOne: jest.fn() } }));

type QueryOptions = {
  queryKey: unknown[];
  enabled?: boolean;
  refetchOnMount?: unknown;
  queryFn: () => unknown;
  throwOnError?: unknown;
};

const args = {
  teamId: 2,
  edfiTenantId: 10 as number | undefined,
  runId: 7 as number | undefined,
  enabled: true,
};

type QueryState = { data?: unknown; isPending: boolean; isError?: boolean };

const render = (overrides: Partial<typeof args> = {}, state: QueryState = { isPending: true }) => {
  (useQuery as jest.Mock).mockReturnValue({ refetch: jest.fn(), ...state });
  const { result } = renderHook(() => useCertificationScenarioStatuses({ ...args, ...overrides }));
  const options = (useQuery as jest.Mock).mock.calls.at(-1)[0] as QueryOptions;
  return { result: result.current, options };
};

describe('useCertificationScenarioStatuses', () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the run's scenario-statuses route, keyed by team and run", async () => {
    const { options } = render();
    await options.queryFn();

    expect(methods.getOne).toHaveBeenCalledWith(
      'teams/2/edfi-tenants/10/certification/runs/7/scenario-statuses',
      CertificationScenarioStatusesDto,
    );
    expect(options.queryKey).toEqual(certificationQueryKeys.scenarioStatuses(2, 7));
    expect(options.queryKey).toEqual(['certification', 2, 'scenario-statuses', 7]);
  });

  it('keys each run separately, so a finished run never shows under the next one', () => {
    expect(render({ runId: 8 }).options.queryKey).toEqual([
      'certification',
      2,
      'scenario-statuses',
      8,
    ]);
  });

  it('always refetches on mount so a saved run elsewhere is reflected', () => {
    expect(render().options.refetchOnMount).toBe('always');
  });

  it('does not send a failed load to the error page', () => {
    expect(render().options.throwOnError).toBeUndefined();
  });

  it.each([
    ['disabled by the caller', { enabled: false }],
    ['missing a tenant', { edfiTenantId: undefined }],
    ['missing a run', { runId: undefined }],
  ])('is disabled when %s', (_label, overrides) => {
    const { options, result } = render(overrides);
    expect(options.enabled).toBe(false);
    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(false);
    expect(result.isUnknown).toBe(true);
  });

  it('is enabled once the caller enables it with a tenant and run known', () => {
    expect(render().options.enabled).toBe(true);
  });

  it('indexes the statuses by scenarioId', () => {
    const { result } = render(
      {},
      {
        data: {
          run: { runId: 7, status: 'DRAFT', canExecuteSteps: true },
          scenarios: [
            { scenarioId: 52, status: 'completed' },
            { scenarioId: 51, status: 'failed' },
          ],
        },
        isPending: false,
      },
    );

    expect(result.statusByScenarioId).toEqual({ 52: 'completed', 51: 'failed' });
    expect(result.isLoading).toBe(false);
    expect(result.isUnknown).toBe(false);
  });

  it('treats a loaded empty list as known, not unknown', () => {
    const { result } = render({}, { data: { run: null, scenarios: [] }, isPending: false });
    expect(result.isUnknown).toBe(false);
  });

  it('exposes the run and that steps cannot run while it is in review', () => {
    const run = { runId: 7, status: 'IN_REVIEW', canExecuteSteps: false };
    const { result } = render(
      {},
      { data: { run, scenarios: [{ scenarioId: 3, status: 'completed' }] }, isPending: false },
    );
    expect(result.run).toEqual(run);
    expect(result.canExecuteSteps).toBe(false);
    expect(result.statusByScenarioId).toEqual({ 3: 'completed' });
  });

  it('does not block steps while the run is still unknown', () => {
    const { result } = render();
    expect(result.run).toBeUndefined();
    expect(result.canExecuteSteps).toBe(true);
  });

  it('is loading and unknown with no statuses while the first load runs', () => {
    const { result } = render();
    expect(result.statusByScenarioId).toEqual({});
    expect(result.isLoading).toBe(true);
    expect(result.isUnknown).toBe(true);
  });

  it('reports a failed first load as an error with unknown statuses', () => {
    const { result } = render({}, { isPending: false, isError: true });
    expect(result.isError).toBe(true);
    expect(result.isStale).toBe(false);
    expect(result.isUnknown).toBe(true);
  });

  it('reports a failed refresh as stale and keeps the old statuses', () => {
    const { result } = render(
      {},
      {
        data: { run: null, scenarios: [{ scenarioId: 52, status: 'completed' }] },
        isPending: false,
        isError: true,
      },
    );
    expect(result.isError).toBe(true);
    expect(result.isStale).toBe(true);
    expect(result.isUnknown).toBe(false);
    expect(result.statusByScenarioId).toEqual({ 52: 'completed' });
  });
});
