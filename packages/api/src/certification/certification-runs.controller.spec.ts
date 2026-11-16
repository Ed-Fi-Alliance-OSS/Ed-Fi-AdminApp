import { NotFoundException } from '@nestjs/common';
import { INTERCEPTORS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SbEnvironmentEdfiTenantInterceptor } from '../app/sb-environment-edfi-tenant.interceptor';
import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import {
  CertificationRunsController,
  CertificationTeamRunsController,
} from './certification-runs.controller';
import { CertificationSupportInterceptor } from './certification-support.interceptor';

const READ = 'team.sb-environment.edfi-tenant.ods.certification:read';
const RUN = 'team.sb-environment.edfi-tenant.ods.certification:run';
const subject = { id: '__filtered__', edfiTenantId: 'edfiTenantId', teamId: 'teamId' };

describe('CertificationRunsController', () => {
  const sbEnvironment = { id: 1 } as never;
  const edfiTenant = { id: 10, name: 'tenant1' } as never;
  const body = { odsId: 5, certificationModel: 'SIS' } as never;
  const runDto = { runId: 7, status: 'DRAFT' };
  let runsService: { createRun: jest.Mock; findLatestRuns: jest.Mock };
  let controller: CertificationRunsController;

  beforeEach(() => {
    runsService = {
      createRun: jest.fn().mockResolvedValue(runDto),
      findLatestRuns: jest.fn().mockResolvedValue([]),
    };
    controller = new CertificationRunsController(runsService as never);
  });

  it("lives under the team's tenant", () => {
    expect(Reflect.getMetadata(PATH_METADATA, CertificationRunsController)).toBe(
      'teams/:teamId/edfi-tenants/:edfiTenantId/certification/runs',
    );
  });

  it('resolves the environment, then refuses unsupported data models', () => {
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, CertificationRunsController)).toEqual([
      SbEnvironmentEdfiTenantInterceptor,
      CertificationSupportInterceptor,
    ]);
  });

  describe('createRun', () => {
    it('starts the run for the team, the route tenant and the signed-in user', async () => {
      const result = await controller.createRun(2, sbEnvironment, edfiTenant, body, new Set([5]), {
        id: 42,
      } as never);

      expect(runsService.createRun).toHaveBeenCalledWith({
        teamId: 2,
        sbEnvironment,
        edfiTenant,
        odsId: 5,
        certificationModel: 'SIS',
        userId: 42,
      });
      expect(result).toBe(runDto);
    });

    it("answers 404 and creates nothing for a data store outside the user's privilege", async () => {
      await expect(
        controller.createRun(2, sbEnvironment, edfiTenant, body, new Set([6]), { id: 42 } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(runsService.createRun).not.toHaveBeenCalled();
    });

    it('is guarded by certification:run', () => {
      expect(
        Reflect.getMetadata(AUTHORIZE_KEY, CertificationRunsController.prototype.createRun),
      ).toEqual({ privilege: RUN, subject });
    });
  });

  describe('getLatestRuns', () => {
    it('reads the newest run of each model on the data store', async () => {
      await controller.getLatestRuns(10, 5, true);

      expect(runsService.findLatestRuns).toHaveBeenCalledWith({ edfiTenantId: 10, odsId: 5 });
    });

    it("answers 404 for a data store outside the user's privilege", async () => {
      await expect(controller.getLatestRuns(10, 5, new Set())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(runsService.findLatestRuns).not.toHaveBeenCalled();
    });

    it('is guarded by certification:read', () => {
      expect(
        Reflect.getMetadata(AUTHORIZE_KEY, CertificationRunsController.prototype.getLatestRuns),
      ).toEqual({ privilege: READ, subject });
    });
  });
});

describe('CertificationTeamRunsController', () => {
  const certificationRun = { certificationRunId: 7, edfiTenantId: 10 };
  const runDto = { runId: 7 };
  let runsService: { findTeamRun: jest.Mock; toDto: jest.Mock };
  let controller: CertificationTeamRunsController;

  beforeEach(() => {
    runsService = {
      findTeamRun: jest.fn().mockResolvedValue(certificationRun),
      toDto: jest.fn().mockReturnValue(runDto),
    };
    controller = new CertificationTeamRunsController(runsService as never);
  });

  it('lives under the team, because the page only knows the run', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CertificationTeamRunsController)).toBe(
      'teams/:teamId/certification/runs',
    );
  });

  it("returns the team's run", async () => {
    await expect(controller.getRun(2, 7, {})).resolves.toBe(runDto);

    expect(runsService.findTeamRun).toHaveBeenCalledWith({
      runId: 7,
      teamId: 2,
      validOdsIds: expect.any(Function),
    });
    expect(runsService.toDto).toHaveBeenCalledWith(certificationRun);
  });

  it("checks certification:read on the run's own tenant", async () => {
    const tenantTenIds = new Set([5]);
    await controller.getRun(2, 7, { [READ]: { 10: tenantTenIds, 11: true } } as never);

    const { validOdsIds } = runsService.findTeamRun.mock.calls[0][0];
    expect(validOdsIds(10)).toBe(tenantTenIds);
    expect(validOdsIds(12)).toBeUndefined();
  });

  it('only lets team members with environment access reach the check', () => {
    expect(
      Reflect.getMetadata(AUTHORIZE_KEY, CertificationTeamRunsController.prototype.getRun),
    ).toEqual({
      privilege: 'team.sb-environment:read',
      subject: { id: '__filtered__', teamId: 'teamId' },
    });
  });
});
