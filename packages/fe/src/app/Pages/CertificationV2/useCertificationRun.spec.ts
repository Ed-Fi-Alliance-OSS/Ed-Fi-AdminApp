import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CertificationLatestRunDto, CertificationRunDto } from '@edanalytics/models';
import { methods } from '../../api';
import { apiClient } from '../../api-v2/apiClient';
import { certificationQueryKeys } from './useCertificationCatalog';
import {
  certificationRunErrorMessage,
  toRunId,
  useCertificationRun,
  useLatestCertificationRuns,
  useStartCertificationRun,
} from './useCertificationRun';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock('../../api', () => ({ methods: { getOne: jest.fn(), getMany: jest.fn() } }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { post: jest.fn() } }));

type QueryOptions = {
  queryKey: unknown[];
  enabled?: boolean;
  throwOnError?: unknown;
  refetchOnMount?: unknown;
  queryFn: () => unknown;
};
const lastQuery = () => (useQuery as jest.Mock).mock.calls.at(-1)[0] as QueryOptions;

describe('toRunId', () => {
  it('reads a positive whole number', () => {
    expect(toRunId('7')).toBe(7);
  });

  it.each([undefined, '', 'abc', '0', '-1', '1.5'])('treats %p as no run', (value) => {
    expect(toRunId(value)).toBeUndefined();
  });
});

describe('useCertificationRun', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the run by its ID alone, under the team', async () => {
    const run = { runId: 7, edfiTenantId: 10 };
    (useQuery as jest.Mock).mockReturnValue({ data: run, isPending: false });

    const { result } = renderHook(() => useCertificationRun(2, 7));
    await lastQuery().queryFn();

    expect(methods.getOne).toHaveBeenCalledWith(
      'teams/2/certification/runs/7',
      CertificationRunDto,
    );
    expect(lastQuery().queryKey).toEqual(['certification', 2, 'run', 7]);
    expect(result.current).toEqual({ run, isPending: false });
  });

  it('sends a run the user may not see (404) to the error page', () => {
    (useQuery as jest.Mock).mockReturnValue({ isPending: true });
    renderHook(() => useCertificationRun(2, 7));

    expect(lastQuery().throwOnError).toBe(true);
  });

  it('asks for nothing when the address has no valid run ID', () => {
    (useQuery as jest.Mock).mockReturnValue({ isPending: true });
    const { result } = renderHook(() => useCertificationRun(2, undefined));

    expect(lastQuery().enabled).toBe(false);
    expect(result.current).toEqual({ run: undefined, isPending: false });
  });
});

describe('useLatestCertificationRuns', () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the data store's newest run of each model and indexes them by model", async () => {
    const sis = { certificationModel: 'SIS', runId: 7, status: 'DRAFT', isOpen: true };
    (useQuery as jest.Mock).mockReturnValue({ data: [sis], isPending: false });

    const { result } = renderHook(() =>
      useLatestCertificationRuns({ teamId: 2, edfiTenantId: 10, odsId: 5 }),
    );
    await lastQuery().queryFn();

    expect(methods.getMany).toHaveBeenCalledWith(
      'teams/2/edfi-tenants/10/certification/runs/latest',
      CertificationLatestRunDto,
      { params: { odsId: 5 } },
    );
    expect(lastQuery().queryKey).toEqual(certificationQueryKeys.latestRuns(2, 10, 5));
    expect(result.current.latestByModel).toEqual({ SIS: sis });
    expect(result.current.isPending).toBe(false);
  });

  it('always refetches when the popup opens, so a run finished elsewhere frees its model', () => {
    (useQuery as jest.Mock).mockReturnValue({ isPending: true });
    renderHook(() => useLatestCertificationRuns({ teamId: 2, edfiTenantId: 10, odsId: 5 }));

    expect(lastQuery().refetchOnMount).toBe('always');
  });

  it.each([
    ['tenant', { edfiTenantId: undefined, odsId: 5 }],
    ['data store', { edfiTenantId: 10, odsId: undefined }],
  ])('asks for nothing until the %s is chosen', (_label, selection) => {
    (useQuery as jest.Mock).mockReturnValue({
      data: [{ certificationModel: 'SIS' }],
      isPending: true,
    });
    const { result } = renderHook(() => useLatestCertificationRuns({ teamId: 2, ...selection }));

    expect(lastQuery().enabled).toBe(false);
    // A disabled query keeps its cached data; it must not disable a model for another data store.
    expect(result.current).toMatchObject({ latestByModel: {}, isPending: false });
  });
});

describe('useStartCertificationRun', () => {
  beforeEach(() => jest.clearAllMocks());

  it("posts the data store and model to the team's tenant", async () => {
    const created = { runId: 7 };
    (apiClient.post as jest.Mock).mockResolvedValue(created);
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: jest.fn() });
    useStartCertificationRun();
    const { mutationFn } = (useMutation as jest.Mock).mock.calls[0][0];
    const body = { odsId: 5, certificationModel: 'SIS' };

    await expect(mutationFn({ teamId: 2, edfiTenantId: 10, body })).resolves.toBe(created);
    expect(apiClient.post).toHaveBeenCalledWith('teams/2/edfi-tenants/10/certification/runs', body);
  });

  it.each(['onSuccess', 'onError'] as const)(
    "refreshes the team's certification data %s, so the popup shows which models are open",
    (handler) => {
      const invalidateQueries = jest.fn();
      (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
      useStartCertificationRun();

      (useMutation as jest.Mock).mock.calls[0][0][handler](undefined, { teamId: 2 });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['certification', 2] });
    },
  );
});

describe('certificationRunErrorMessage', () => {
  it('returns the message of a refused run, such as the 409 for an open run', () => {
    expect(
      certificationRunErrorMessage({
        status: 409,
        message: 'A SIS run is already open for this data store.',
      }),
    ).toBe('A SIS run is already open for this data store.');
  });

  it('returns the message of a validation error', () => {
    expect(
      certificationRunErrorMessage({
        data: {
          errors: {
            certificationModel: { message: "This Certification Model isn't available yet." },
          },
        },
      }),
    ).toBe("This Certification Model isn't available yet.");
  });

  it.each([undefined, 'boom', {}, { message: 42 }])('falls back for %p', (error) => {
    expect(certificationRunErrorMessage(error)).toBe("The run couldn't be started. Try again.");
  });
});
