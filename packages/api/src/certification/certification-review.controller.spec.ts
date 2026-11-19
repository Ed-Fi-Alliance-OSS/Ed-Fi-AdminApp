import 'reflect-metadata';
import { CERT_REVIEW_DECISION } from '@edanalytics/models';
import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CertificationReviewController } from './certification-review.controller';

const proto = CertificationReviewController.prototype;
const GET = 0;
const POST = 1;

describe('CertificationReviewController', () => {
  const service = {
    pickUp: jest.fn(),
    getReview: jest.fn(),
    getSnapshot: jest.fn(),
    decide: jest.fn(),
  };
  const controller = new CertificationReviewController(service as never);

  beforeEach(() => jest.resetAllMocks());

  it('serves under certification/runs/:runId', () => {
    expect(Reflect.getMetadata('path', CertificationReviewController)).toBe(
      'certification/runs/:runId',
    );
  });

  it.each([
    ['pickUp', 'pick-up', POST],
    ['getReview', 'review', GET],
    ['getSnapshot', 'step-runs/:stepId/snapshot', GET],
    ['approve', 'approve', POST],
    ['reject', 'reject', POST],
    ['requestChanges', 'request-changes', POST],
  ] as const)('%s is guarded by certification:review at %s', (name, path, method) => {
    const handler = proto[name];
    expect(Reflect.getMetadata(AUTHORIZE_KEY, handler)).toEqual({
      privilege: 'certification:review',
      subject: { id: '__filtered__' },
    });
    expect(Reflect.getMetadata('path', handler)).toBe(path);
    expect(Reflect.getMetadata('method', handler)).toBe(method);
  });

  it('does not cache the snapshot', () => {
    expect(Reflect.getMetadata('__headers__', proto.getSnapshot)).toEqual([
      { name: 'Cache-Control', value: 'no-store' },
    ]);
  });

  it('delegates pickUp, getReview and getSnapshot', async () => {
    service.pickUp.mockResolvedValue('p');
    service.getReview.mockResolvedValue('r');
    service.getSnapshot.mockResolvedValue('s');
    await expect(controller.pickUp(7)).resolves.toBe('p');
    await expect(controller.getReview(7)).resolves.toBe('r');
    await expect(controller.getSnapshot(7, 3)).resolves.toBe('s');
    expect(service.getSnapshot).toHaveBeenCalledWith(7, 3);
  });

  it('approve passes the decision, comment and session user', async () => {
    service.decide.mockResolvedValue('ok');
    await expect(controller.approve(7, {} as never, { id: 5 } as never)).resolves.toBe('ok');
    expect(service.decide).toHaveBeenCalledWith({
      runId: 7,
      decision: CERT_REVIEW_DECISION.APPROVED,
      comment: undefined,
      userId: 5,
    });
  });

  it('reject and requestChanges pass their decision and comment', async () => {
    await controller.reject(7, { comment: 'no' } as never, { id: 5 } as never);
    await controller.requestChanges(7, { comment: 'fix' } as never, { id: 5 } as never);
    expect(service.decide).toHaveBeenNthCalledWith(1, {
      runId: 7,
      decision: CERT_REVIEW_DECISION.REJECTED,
      comment: 'no',
      userId: 5,
    });
    expect(service.decide).toHaveBeenNthCalledWith(2, {
      runId: 7,
      decision: CERT_REVIEW_DECISION.CHANGES_REQUESTED,
      comment: 'fix',
      userId: 5,
    });
  });

  it('passes a null userId without a session', async () => {
    await controller.approve(7, {} as never, undefined);
    expect(service.decide).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });
});
