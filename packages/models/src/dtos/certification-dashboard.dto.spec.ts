import { CERT_RUN_STATUS } from './certification-run.dto';
import {
  CERT_DASHBOARD_OTHERS_LIMIT,
  CERT_DASHBOARD_OTHER_STATUSES,
  CERT_DASHBOARD_WAITING_STATUSES,
} from './certification-dashboard.dto';

describe('certification dashboard constants', () => {
  it('waiting statuses are exactly the review queue', () => {
    expect([...CERT_DASHBOARD_WAITING_STATUSES]).toEqual([
      CERT_RUN_STATUS.READY_FOR_REVIEW,
      CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
    ]);
  });

  it('other statuses are every status except the two waiting ones (IN_REVIEW included)', () => {
    expect([...CERT_DASHBOARD_OTHER_STATUSES].sort()).toEqual(
      [
        CERT_RUN_STATUS.DRAFT,
        CERT_RUN_STATUS.IN_REVIEW,
        CERT_RUN_STATUS.CHANGES_REQUESTED,
        CERT_RUN_STATUS.APPROVED,
        CERT_RUN_STATUS.REJECTED,
      ].sort()
    );
    expect(CERT_DASHBOARD_OTHER_STATUSES).toContain(CERT_RUN_STATUS.IN_REVIEW);
  });

  it('waiting and other statuses never overlap', () => {
    const overlap = CERT_DASHBOARD_WAITING_STATUSES.filter((s) =>
      CERT_DASHBOARD_OTHER_STATUSES.includes(s)
    );
    expect(overlap).toEqual([]);
    expect(
      new Set([...CERT_DASHBOARD_WAITING_STATUSES, ...CERT_DASHBOARD_OTHER_STATUSES]).size
    ).toBe(Object.values(CERT_RUN_STATUS).length);
  });

  it('limit is 100', () => {
    expect(CERT_DASHBOARD_OTHERS_LIMIT).toBe(100);
  });
});
