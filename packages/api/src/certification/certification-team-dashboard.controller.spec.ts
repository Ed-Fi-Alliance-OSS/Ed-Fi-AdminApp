import { PATH_METADATA } from '@nestjs/common/constants';
import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CERT_READ } from './certification-authorization';
import { CertificationTeamDashboardController } from './certification-team-dashboard.controller';

describe('CertificationTeamDashboardController', () => {
  const payload = {
    counts: { waitingOnUs: 1, readyForReview: 0, executingNow: 1, certified: 0 },
    dataStores: [
      {
        edfiTenantId: 10,
        odsId: 5,
        environmentName: 'env',
        tenantName: 'tenant',
        dataStoreName: 'ds',
        runs: [{ runId: 55, certificationModel: 'SIS', status: 'DRAFT' }],
      },
    ],
  };
  let service: { getDashboard: jest.Mock };
  let controller: CertificationTeamDashboardController;

  beforeEach(() => {
    service = { getDashboard: jest.fn().mockResolvedValue(payload) };
    controller = new CertificationTeamDashboardController(service as never);
  });

  it('lives at teams/:teamId/certification/dashboard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CertificationTeamDashboardController)).toBe(
      'teams/:teamId/certification/dashboard',
    );
  });

  it('is guarded like the team run route', () => {
    expect(
      Reflect.getMetadata(
        AUTHORIZE_KEY,
        CertificationTeamDashboardController.prototype.getDashboard,
      ),
    ).toEqual({
      privilege: 'team.sb-environment:read',
      subject: { id: '__filtered__', teamId: 'teamId' },
    });
  });

  it('asks the service for the team, reading data stores from the authorization cache', async () => {
    await controller.getDashboard(7, { [CERT_READ]: { 10: new Set([5]) } } as never);

    const args = service.getDashboard.mock.calls[0][0];
    expect(args.teamId).toBe(7);
    expect(args.validOdsIds(10)).toEqual(new Set([5]));
    expect(args.validOdsIds(11)).toBeUndefined();
  });

  it('treats a missing authorization cache as no readable data stores', async () => {
    await controller.getDashboard(7, undefined as never);
    expect(service.getDashboard.mock.calls[0][0].validOdsIds(10)).toBeUndefined();
  });

  it('serializes through toCertificationTeamDashboardDto', async () => {
    const result = await controller.getDashboard(7, {} as never);
    expect(result.dataStores[0].runs[0].runId).toBe(55);
    expect(result.counts.waitingOnUs).toBe(1);
  });
});
