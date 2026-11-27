import 'reflect-metadata';
import { CERT_RUN_STATUS, CertRunStatus } from '@edanalytics/models';
import { pickUpDisabledReason } from './pickUpAvailability';

describe('pickUpDisabledReason', () => {
  it.each([CERT_RUN_STATUS.READY_FOR_REVIEW, CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES])(
    'is enabled for %s when the user can review',
    (status) => {
      expect(pickUpDisabledReason(status, true)).toBeNull();
    },
  );

  it.each<[CertRunStatus, string]>([
    [CERT_RUN_STATUS.IN_REVIEW, 'Already picked up'],
    [CERT_RUN_STATUS.DRAFT, 'The vendor is still working on this run'],
    [CERT_RUN_STATUS.CHANGES_REQUESTED, 'The vendor is still working on this run'],
    [CERT_RUN_STATUS.APPROVED, 'Already decided'],
    [CERT_RUN_STATUS.REJECTED, 'Already decided'],
  ])('explains why %s cannot be picked up', (status, reason) => {
    expect(pickUpDisabledReason(status, true)).toBe(reason);
  });

  it('reports the permission reason first when the user cannot review', () => {
    expect(pickUpDisabledReason(CERT_RUN_STATUS.READY_FOR_REVIEW, false)).toBe(
      'You need review permission',
    );
    expect(pickUpDisabledReason(CERT_RUN_STATUS.APPROVED, false)).toBe(
      'You need review permission',
    );
  });
});
