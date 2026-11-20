import 'reflect-metadata';
import { CERT_RUN_STATUS } from './certification-run.dto';
import type { CertRunStatus } from './certification-run.dto';
import {
  CERT_TEAM_DASHBOARD_REVIEW_STATUSES,
  CERT_TEAM_DASHBOARD_WAITING_STATUSES,
  toCertificationTeamDashboardCounts,
  toCertificationTeamDashboardDto,
} from './certification-team-dashboard.dto';

describe('team certification dashboard constants', () => {
  it('waiting statuses are Draft and Changes requested', () => {
    expect([...CERT_TEAM_DASHBOARD_WAITING_STATUSES]).toEqual([
      CERT_RUN_STATUS.DRAFT,
      CERT_RUN_STATUS.CHANGES_REQUESTED,
    ]);
  });

  it('review statuses are Ready for review, In review and Ready for review with new changes', () => {
    expect([...CERT_TEAM_DASHBOARD_REVIEW_STATUSES]).toEqual([
      CERT_RUN_STATUS.READY_FOR_REVIEW,
      CERT_RUN_STATUS.IN_REVIEW,
      CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
    ]);
  });
});

describe('toCertificationTeamDashboardCounts', () => {
  it('counts one status each into its card', () => {
    expect(
      toCertificationTeamDashboardCounts([
        'DRAFT',
        'CHANGES_REQUESTED',
        'READY_FOR_REVIEW',
        'IN_REVIEW',
        'READY_FOR_REVIEW_WITH_CHANGES',
        'APPROVED',
        'REJECTED',
      ] as CertRunStatus[])
    ).toEqual({ waitingOnUs: 2, readyForReview: 3, executingNow: 5, certified: 1 });
  });

  it('executingNow is every open status and never counts Approved or Rejected', () => {
    expect(toCertificationTeamDashboardCounts(['APPROVED', 'REJECTED'] as CertRunStatus[])).toEqual({
      waitingOnUs: 0,
      readyForReview: 0,
      executingNow: 0,
      certified: 1,
    });
  });

  it('empty input gives zeros', () => {
    expect(toCertificationTeamDashboardCounts([])).toEqual({
      waitingOnUs: 0,
      readyForReview: 0,
      executingNow: 0,
      certified: 0,
    });
  });
});

describe('toCertificationTeamDashboardDto', () => {
  it('serializer keeps nested runs', () => {
    const dto = toCertificationTeamDashboardDto({
      counts: { waitingOnUs: 1, readyForReview: 0, executingNow: 1, certified: 0 },
      dataStores: [
        {
          edfiTenantId: 1,
          odsId: 2,
          environmentName: 'env',
          tenantName: 'tenant',
          dataStoreName: 'ds',
          runs: [{ runId: 55, certificationModel: 'SIS', status: 'DRAFT' }],
        },
      ],
    } as never);
    expect(dto.dataStores[0].runs[0].runId).toBe(55);
  });
});
