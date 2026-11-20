import 'reflect-metadata';
import { CertificationRunCommentDto } from '@edanalytics/models';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';
import { useCertificationRunComments } from './useCertificationRunComments';

jest.mock('../../api', () => ({ methods: { getMany: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children,
  );

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

    const { result } = renderHook(() => useCertificationRunComments(2, 7), { wrapper });

    await waitFor(() => expect(methods.getMany).toHaveBeenCalled());
    expect(result.current).toEqual({ comments: [] });
  });

  it('does not read without a run ID', () => {
    const { result } = renderHook(() => useCertificationRunComments(2, undefined), { wrapper });

    expect(methods.getMany).not.toHaveBeenCalled();
    expect(result.current.comments).toEqual([]);
  });
});
