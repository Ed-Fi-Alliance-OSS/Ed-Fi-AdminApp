import 'reflect-metadata';
import { CertificationRunCommentDto } from '@edanalytics/models';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';
import { useCertificationRunComments } from './useCertificationRunComments';

jest.mock('../../api', () => ({ methods: { getMany: jest.fn() } }));

// The app keeps reads fresh for 5 minutes (app.tsx), so the tests do too.
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
const wrapperFor =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
const wrapper = wrapperFor(newClient());

describe('useCertificationRunComments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the comments of the run under the team', async () => {
    const comments = [{ commentId: 1, text: 'Fix it' }];
    (methods.getMany as jest.Mock).mockResolvedValue(comments);

    const { result } = renderHook(() => useCertificationRunComments(2, 7), { wrapper });

    expect(result.current.comments).toEqual([]);
    await waitFor(() => expect(result.current.comments).toEqual(comments));
    expect(methods.getMany).toHaveBeenCalledWith(
      'teams/2/certification/runs/7/comments',
      CertificationRunCommentDto,
    );
  });

  it('keys the query under the team so sending to review refreshes it', () => {
    expect(certificationQueryKeys.runComments(2, 7).slice(0, 2)).toEqual(
      certificationQueryKeys.all(2),
    );
  });

  it('returns no comments when the request fails, without throwing', async () => {
    (methods.getMany as jest.Mock).mockRejectedValue(new Error('boom'));

    const client = newClient();
    const { result } = renderHook(() => useCertificationRunComments(2, 7), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(client.getQueryState(certificationQueryKeys.runComments(2, 7))?.status).toBe('error'),
    );
    expect(result.current).toEqual({ comments: [] });
  });

  it('reads again when mounted again, even within the stale time', async () => {
    (methods.getMany as jest.Mock).mockResolvedValue([]);
    const client = newClient();

    const first = renderHook(() => useCertificationRunComments(2, 7), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(methods.getMany).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(client.getQueryState(certificationQueryKeys.runComments(2, 7))?.status).toBe(
        'success',
      ),
    );
    first.unmount();

    renderHook(() => useCertificationRunComments(2, 7), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(methods.getMany).toHaveBeenCalledTimes(2));
  });

  it('does not read without a run ID', () => {
    const { result } = renderHook(() => useCertificationRunComments(2, undefined), { wrapper });

    expect(methods.getMany).not.toHaveBeenCalled();
    expect(result.current.comments).toEqual([]);
  });
});
