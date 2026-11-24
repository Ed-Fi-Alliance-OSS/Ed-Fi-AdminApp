import 'reflect-metadata';
import { CertificationRunEventPageDto } from '@edanalytics/models';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';
import { useCertificationRunEvents } from './useCertificationRunEvents';

jest.mock('../../api', () => ({ methods: { getOne: jest.fn() } }));

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
const wrapperFor =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

const event = (eventId: number) => ({ eventId, event: 'CREATED', actorName: 'Ann' });
const URL = 'teams/2/certification/runs/7/events';

describe('useCertificationRunEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the first page with offset 0 and limit 50', async () => {
    (methods.getOne as jest.Mock).mockResolvedValue({ items: [event(1)], total: 1 });

    const { result } = renderHook(() => useCertificationRunEvents(2, 7), {
      wrapper: wrapperFor(newClient()),
    });

    expect(result.current.events).toEqual([]);
    await waitFor(() => expect(result.current.events).toEqual([event(1)]));
    expect(methods.getOne).toHaveBeenCalledWith(URL, CertificationRunEventPageDto, {
      offset: 0,
      limit: 50,
    });
  });

  it('loadMore requests the next offset', async () => {
    (methods.getOne as jest.Mock)
      .mockResolvedValueOnce({ items: [event(1), event(2)], total: 3 })
      .mockResolvedValueOnce({ items: [event(3)], total: 3 });

    const { result } = renderHook(() => useCertificationRunEvents(2, 7), {
      wrapper: wrapperFor(newClient()),
    });
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.events).toHaveLength(3));
    expect(methods.getOne).toHaveBeenLastCalledWith(URL, CertificationRunEventPageDto, {
      offset: 2,
      limit: 50,
    });
  });

  it('hasMore is false once all entries loaded', async () => {
    (methods.getOne as jest.Mock).mockResolvedValue({ items: [event(1), event(2)], total: 2 });

    const { result } = renderHook(() => useCertificationRunEvents(2, 7), {
      wrapper: wrapperFor(newClient()),
    });

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
  });

  it('is disabled without a run id', () => {
    const { result } = renderHook(() => useCertificationRunEvents(2, undefined), {
      wrapper: wrapperFor(newClient()),
    });

    expect(methods.getOne).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
  });

  it('reports an error when the read fails', async () => {
    (methods.getOne as jest.Mock).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useCertificationRunEvents(2, 7), {
      wrapper: wrapperFor(newClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('keys the query under the team and refetches when the team keys are invalidated', async () => {
    expect(certificationQueryKeys.runEvents(2, 7).slice(0, 2)).toEqual(
      certificationQueryKeys.all(2),
    );
    (methods.getOne as jest.Mock)
      .mockResolvedValueOnce({ items: [event(1)], total: 1 })
      .mockResolvedValueOnce({ items: [event(1), event(2)], total: 2 });
    const client = newClient();
    const { result } = renderHook(() => useCertificationRunEvents(2, 7), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    await act(() => client.invalidateQueries({ queryKey: certificationQueryKeys.all(2) }));

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events[1]).toEqual(event(2));
  });
});
