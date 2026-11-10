import 'reflect-metadata';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CertificationStepRunsDto } from '@edanalytics/models';
import { ReactNode } from 'react';
import { methods } from '../../api';
import { useCertificationStepRuns } from './useCertificationStepRuns';
import { useCertificationStepSnapshot } from './useCertificationStepSnapshot';

jest.mock('../../api', () => ({ methods: { getOne: jest.fn() } }));

const scope = { sbEnvironmentId: 1, edfiTenantId: 10, odsId: 5, sisVersion: 'v5' };
const priorStep = {
  stepId: 189,
  status: 'failed',
  ranAt: '2026-10-15T15:00:00.000Z',
  inputs: { schoolId: 'old-attempt' },
  responseStatus: 500,
  errors: [],
};
const priorResults = { scenarioStatus: 'failed', steps: [priorStep] };
const emptyResults = { scenarioStatus: null, steps: [] };
const initialProps = { runId: 7 as number | null | undefined };

describe('certification result caches (real QueryClient)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.resetAllMocks();
    client = new QueryClient({
      defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: false, gcTime: Infinity } },
    });
  });

  afterEach(() => client.clear());

  it.each([
    { runId: null, requests: 1 },
    { runId: undefined, requests: 1 },
    { runId: 8, requests: 2 },
  ])(
    'does not reuse fresh step results or inputs when the open run becomes $runId',
    async ({ runId, requests }) => {
      (methods.getOne as jest.Mock)
        .mockResolvedValueOnce(priorResults)
        .mockResolvedValueOnce(emptyResults);
      const { result, rerender } = renderHook(
        (props) => useCertificationStepRuns({ ...scope, scenarioId: 52, ...props }),
        { wrapper, initialProps },
      );
      await waitFor(() => expect(result.current.runsByStepId[189]).toEqual(priorStep));

      rerender({ runId });

      expect(result.current.runsByStepId).toEqual({});
      expect(result.current.scenarioStatus).toBeNull();
      await waitFor(() => expect(methods.getOne).toHaveBeenCalledTimes(requests));
      await waitFor(() => expect(result.current.isPending).toBe(false));
    },
  );

  it.each([
    { runId: null, requests: 1, expected: undefined },
    { runId: undefined, requests: 1, expected: undefined },
    { runId: 8, requests: 2, expected: { state: 'body', body: 'current attempt' } },
  ])(
    'does not reuse a fresh snapshot with the same step/time when the open run becomes $runId',
    async ({ runId, requests, expected }) => {
      const previous = { state: 'body', body: 'previous attempt' };
      const current = { state: 'body', body: 'current attempt' };
      (methods.getOne as jest.Mock).mockResolvedValueOnce(previous).mockResolvedValueOnce(current);
      const { result, rerender } = renderHook(
        (props) =>
          useCertificationStepSnapshot({
            ...scope,
            stepId: 189,
            ranAt: priorStep.ranAt,
            enabled: true,
            ...props,
          }),
        { wrapper, initialProps },
      );
      await waitFor(() => expect(result.current.snapshot).toEqual(previous));

      rerender({ runId });

      expect(result.current.snapshot).toBeUndefined();
      await waitFor(() => expect(result.current.snapshot).toEqual(expected));
      expect(methods.getOne).toHaveBeenCalledTimes(requests);
    },
  );

  it('does not show an old in-flight read after a new run is selected', async () => {
    let resolvePrevious!: (value: CertificationStepRunsDto) => void;
    const pending = new Promise<CertificationStepRunsDto>((resolve) => {
      resolvePrevious = resolve;
    });
    (methods.getOne as jest.Mock).mockReturnValueOnce(pending).mockResolvedValueOnce(emptyResults);
    const { result, rerender } = renderHook(
      (props) => useCertificationStepRuns({ ...scope, scenarioId: 52, ...props }),
      { wrapper, initialProps },
    );
    await waitFor(() => expect(methods.getOne).toHaveBeenCalledTimes(1));
    rerender({ runId: 8 });
    await waitFor(() => expect(methods.getOne).toHaveBeenCalledTimes(2));

    await act(async () =>
      resolvePrevious({
        scenarioStatus: 'failed',
        steps: [
          {
            ...priorStep,
            status: 'failed',
          },
        ],
      }),
    );

    expect(result.current.runsByStepId).toEqual({});
    expect(result.current.scenarioStatus).toBeNull();
  });
});
