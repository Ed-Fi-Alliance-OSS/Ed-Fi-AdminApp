import 'reflect-metadata';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { CERTIFICATION_DASHBOARD_QUERY_KEY } from '../CertificationDashboard/useCertificationDashboard';
import {
  certificationReviewQueryKeys,
  reviewSnapshotSource,
  useCertificationReview,
  useCertificationReviewDecision,
  usePickUpCertificationRun,
} from './useCertificationReview';

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock('../../api', () => ({ methods: {} }));
jest.mock('../../api-v2/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

describe('certificationReviewQueryKeys', () => {
  it('nests the review and its snapshots under one prefix', () => {
    expect(certificationReviewQueryKeys.review(7)).toEqual([
      ...certificationReviewQueryKeys.all,
      7,
    ]);
    expect(certificationReviewQueryKeys.snapshot(7, 3, 'ts')).toEqual([
      ...certificationReviewQueryKeys.all,
      7,
      'snapshot',
      3,
      'ts',
    ]);
  });
});

describe('useCertificationReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the run review and only throws when there is nothing to show', async () => {
    const review = { runId: 7 };
    (apiClient.get as jest.Mock).mockResolvedValue(review);
    useCertificationReview(7, true);
    const options = (useQuery as jest.Mock).mock.calls[0][0];

    expect(options.queryKey).toEqual(certificationReviewQueryKeys.review(7));
    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toBe(review);
    expect(apiClient.get).toHaveBeenCalledWith('certification/runs/7/review');
    expect(options.throwOnError(new Error('x'), { state: { data: undefined } })).toBe(true);
    expect(options.throwOnError(new Error('x'), { state: { data: review } })).toBe(false);
  });

  it('stays disabled without a run id', () => {
    useCertificationReview(undefined, true);
    expect((useQuery as jest.Mock).mock.calls[0][0].enabled).toBe(false);
  });
});

describe('reviewSnapshotSource', () => {
  it('reads snapshots from the global review endpoint', () => {
    const source = reviewSnapshotSource(7);
    expect(source.url(3)).toBe('certification/runs/7/step-runs/3/snapshot');
    expect(source.queryKey(3, 'ts')).toEqual(certificationReviewQueryKeys.snapshot(7, 3, 'ts'));
  });
});

describe('usePickUpCertificationRun', () => {
  const invalidateQueries = jest.fn();
  const options = () => (useMutation as jest.Mock).mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
    usePickUpCertificationRun();
  });

  it('posts to the run pick-up', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ runId: 7 });
    await options().mutationFn({ runId: 7 });
    expect(apiClient.post).toHaveBeenCalledWith('certification/runs/7/pick-up', {});
  });

  it.each(['onSuccess', 'onError'] as const)('refreshes the dashboard %s', (handler) => {
    options()[handler](undefined, { runId: 7 });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: CERTIFICATION_DASHBOARD_QUERY_KEY });
  });
});

describe('useCertificationReviewDecision', () => {
  const invalidateQueries = jest.fn();
  const removeQueries = jest.fn();
  const options = () => (useMutation as jest.Mock).mock.calls[0][0];
  const invalidatedKeys = () => invalidateQueries.mock.calls.map(([arg]) => arg.queryKey);

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries, removeQueries });
    useCertificationReviewDecision();
  });

  it.each([
    ['REJECTED', 'reject'],
    ['CHANGES_REQUESTED', 'request-changes'],
    ['APPROVED', 'approve'],
  ])('posts the comment of %s to %s', async (decision, path) => {
    await options().mutationFn({ runId: 7, decision, comment: 'why' });
    expect(apiClient.post).toHaveBeenCalledWith(`certification/runs/7/${path}`, {
      comment: 'why',
    });
  });

  it('invalidates the dashboard and the review after an approval', () => {
    options().onSuccess(undefined, { runId: 7, decision: 'APPROVED' });
    expect(invalidatedKeys()).toEqual([
      CERTIFICATION_DASHBOARD_QUERY_KEY,
      certificationReviewQueryKeys.review(7),
    ]);
  });

  it('invalidates the dashboard and the review after a rejection', () => {
    options().onSuccess(undefined, { runId: 7, decision: 'REJECTED' });
    expect(invalidatedKeys()).toEqual([
      CERTIFICATION_DASHBOARD_QUERY_KEY,
      certificationReviewQueryKeys.review(7),
    ]);
  });

  it('leaves the review query alone after a change request, since the run is no longer readable', () => {
    options().onSuccess(undefined, { runId: 7, decision: 'CHANGES_REQUESTED' });
    expect(invalidatedKeys()).toEqual([CERTIFICATION_DASHBOARD_QUERY_KEY]);
    expect(removeQueries).not.toHaveBeenCalled();
  });

  it('refetches the dashboard and the run after a refusal such as a 409', () => {
    options().onError(new Error('409'), { runId: 7, decision: 'CHANGES_REQUESTED' });
    expect(invalidatedKeys()).toEqual([
      CERTIFICATION_DASHBOARD_QUERY_KEY,
      certificationReviewQueryKeys.review(7),
    ]);
  });
});
