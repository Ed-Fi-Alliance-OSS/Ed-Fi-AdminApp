import {
  CERT_RUN_STATUS,
  CertRunStatus,
  canExecuteSteps,
  canTransitionRun,
  isOpenRunStatus,
  sendToReviewStatus,
} from './certification-run.dto';

const ALL = Object.values(CERT_RUN_STATUS);

describe('certification run statuses', () => {
  it('has the seven statuses', () => {
    expect(CERT_RUN_STATUS).toEqual({
      DRAFT: 'DRAFT',
      READY_FOR_REVIEW: 'READY_FOR_REVIEW',
      IN_REVIEW: 'IN_REVIEW',
      CHANGES_REQUESTED: 'CHANGES_REQUESTED',
      READY_FOR_REVIEW_WITH_CHANGES: 'READY_FOR_REVIEW_WITH_CHANGES',
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
    });
  });

  it.each(ALL)('canExecuteSteps(%s) is true only for Draft and Changes requested', (status) => {
    expect(canExecuteSteps(status)).toBe(status === 'DRAFT' || status === 'CHANGES_REQUESTED');
  });

  it.each(ALL)('isOpenRunStatus(%s) is false only for Approved and Rejected', (status) => {
    expect(isOpenRunStatus(status)).toBe(status !== 'APPROVED' && status !== 'REJECTED');
  });

  it('allows exactly the seven listed status changes', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => canTransitionRun(from, to)).map((to) => `${from}>${to}`),
    );
    expect(allowed.sort()).toEqual(
      [
        'DRAFT>READY_FOR_REVIEW',
        'CHANGES_REQUESTED>READY_FOR_REVIEW_WITH_CHANGES',
        'READY_FOR_REVIEW>IN_REVIEW',
        'READY_FOR_REVIEW_WITH_CHANGES>IN_REVIEW',
        'IN_REVIEW>CHANGES_REQUESTED',
        'IN_REVIEW>APPROVED',
        'IN_REVIEW>REJECTED',
      ].sort(),
    );
  });

  it('refuses Draft straight to Approved', () => {
    expect(canTransitionRun('DRAFT', 'APPROVED')).toBe(false);
  });

  it('sends a Draft run to Ready for review', () => {
    expect(sendToReviewStatus('DRAFT')).toBe('READY_FOR_REVIEW');
  });

  it('sends a Changes requested run to Ready for review with new changes', () => {
    expect(sendToReviewStatus('CHANGES_REQUESTED')).toBe('READY_FOR_REVIEW_WITH_CHANGES');
  });

  it.each<CertRunStatus>([
    'READY_FOR_REVIEW',
    'IN_REVIEW',
    'READY_FOR_REVIEW_WITH_CHANGES',
    'APPROVED',
    'REJECTED',
  ])('cannot send a %s run to review', (status) => {
    expect(sendToReviewStatus(status)).toBeNull();
  });
});
