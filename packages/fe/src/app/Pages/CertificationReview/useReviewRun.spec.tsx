import 'reflect-metadata';
import { renderHook } from '@testing-library/react';
import { CertificationReviewDto } from '@edanalytics/models';
import { authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { useCertificationReview } from './useCertificationReview';
import { useReviewRun } from './useReviewRun';

let mockParams: { runId?: string } = { runId: '7' };
jest.mock('react-router', () => ({
  useParams: () => mockParams,
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

jest.mock('../../helpers', () => ({
  authorize: jest.fn(),
  usePrivilegeCacheForConfig: jest.fn(),
  useNavContext: jest.fn(),
}));

const mockSource = { url: jest.fn(), queryKey: jest.fn() };
jest.mock('./useCertificationReview', () => ({
  useCertificationReview: jest.fn(),
  reviewSnapshotSource: jest.fn(() => mockSource),
}));

jest.mock('../CertificationV2/useCertificationRun', () => ({
  toRunId: (value: string | undefined) => Number(value) || undefined,
}));

const mockAuthorize = authorize as jest.Mock;
const mockCache = usePrivilegeCacheForConfig as jest.Mock;
const mockReview = useCertificationReview as jest.Mock;
const mockRefetch = jest.fn();

const data = { run: { runId: 7 }, scenarios: [] } as unknown as CertificationReviewDto;

const setup = ({
  canReview = true,
  cacheLoading = false,
  cacheError = undefined as unknown,
  review = { data: undefined as CertificationReviewDto | undefined, error: null as unknown },
} = {}) => {
  mockCache.mockReturnValue([{ isLoading: cacheLoading, error: cacheError }]);
  mockAuthorize.mockReturnValue(canReview);
  mockReview.mockReturnValue({
    ...review,
    isLoading: review.data === undefined && !review.error,
    refetch: mockRefetch,
  });
};

const quiet = (fn: () => void) => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

describe('useReviewRun', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { runId: '7' };
  });

  it('is loading while the privilege cache loads, and does not fetch the run yet', () => {
    setup({ canReview: false, cacheLoading: true });
    const { result } = renderHook(() => useReviewRun());
    expect(result.current).toEqual({ state: 'loading' });
    expect(mockReview).toHaveBeenCalledWith(7, false);
  });

  it('throws "Not allowed" without certification:review', () => {
    setup({ canReview: false });
    quiet(() => expect(() => renderHook(() => useReviewRun())).toThrow('Not allowed'));
  });

  it('rethrows a failed privilege cache request', () => {
    const failure = new Error('cache failed');
    setup({ cacheError: failure });
    quiet(() => expect(() => renderHook(() => useReviewRun())).toThrow('cache failed'));
  });

  it('is notFound for an address without a valid run ID', () => {
    mockParams = { runId: 'abc' };
    setup();
    expect(renderHook(() => useReviewRun()).result.current).toEqual({ state: 'notFound' });
  });

  it('throws when the first load fails', () => {
    setup({ review: { data: undefined, error: { statusCode: 404, message: 'Not Found' } } });
    quiet(() => expect(() => renderHook(() => useReviewRun())).toThrow());
  });

  it('is loading while the run loads', () => {
    setup();
    expect(renderHook(() => useReviewRun()).result.current).toEqual({ state: 'loading' });
  });

  it('is ready with the run and the review snapshot source', () => {
    setup({ review: { data, error: null } });
    expect(renderHook(() => useReviewRun()).result.current).toEqual({
      state: 'ready',
      runId: 7,
      data,
      isUnavailable: false,
      refetchFailed: false,
      retry: expect.any(Function),
      snapshotSource: mockSource,
    });
    expect(mockReview).toHaveBeenCalledWith(7, true);
  });

  it('keeps the cached run and flags it unavailable when a refetch gets a 404', () => {
    setup({ review: { data, error: { statusCode: 404, message: 'Not Found' } } });
    const { result } = renderHook(() => useReviewRun());
    expect(result.current).toMatchObject({
      state: 'ready',
      data,
      isUnavailable: true,
      refetchFailed: false,
    });
  });

  it.each([
    ['a server error', { statusCode: 500, message: 'Internal server error' }],
    ['a dropped connection', new TypeError('Failed to fetch')],
  ])('keeps the cached run and offers a retry when a refetch fails with %s', (_, error) => {
    setup({ review: { data, error } });
    const { result } = renderHook(() => useReviewRun());
    expect(result.current).toMatchObject({
      state: 'ready',
      data,
      isUnavailable: false,
      refetchFailed: true,
    });
    if (result.current.state === 'ready') result.current.retry();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('stops fetching the run when disabled', () => {
    setup({ review: { data, error: null } });
    renderHook(() => useReviewRun({ disabled: true }));
    expect(mockReview).toHaveBeenCalledWith(7, false);
  });
});
