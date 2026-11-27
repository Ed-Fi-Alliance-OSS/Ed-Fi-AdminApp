import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  INTERCEPTORS_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
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
  const comments = [{ commentId: 1 }];
  const history = [{ runId: 9 }, { runId: 7 }];
  const eventPage = { items: [], total: 0 };
  let runsService: {
    findTeamRun: jest.Mock;
    toDto: jest.Mock;
    findRunComments: jest.Mock;
    findTeamRunHistory: jest.Mock;
    findRunEvents: jest.Mock;
  };
  let controller: CertificationTeamRunsController;

  beforeEach(() => {
    runsService = {
      findTeamRun: jest.fn().mockResolvedValue(certificationRun),
      toDto: jest.fn().mockReturnValue(runDto),
      findRunComments: jest.fn().mockResolvedValue(comments),
      findTeamRunHistory: jest.fn().mockResolvedValue(history),
      findRunEvents: jest.fn().mockResolvedValue(eventPage),
    };
    controller = new CertificationTeamRunsController(runsService as never);
  });

  describe('getRunHistory', () => {
    it("returns the team's run history, reading certification:read per tenant", async () => {
      const tenantTenIds = new Set([5]);
      await expect(
        controller.getRunHistory(2, { [READ]: { 10: tenantTenIds } } as never),
      ).resolves.toBe(history);

      const params = runsService.findTeamRunHistory.mock.calls[0][0];
      expect(params.teamId).toBe(2);
      expect(params.validOdsIds(10)).toBe(tenantTenIds);
      expect(params.validOdsIds(12)).toBeUndefined();
    });

    it('is guarded like getRun', () => {
      expect(
        Reflect.getMetadata(AUTHORIZE_KEY, CertificationTeamRunsController.prototype.getRunHistory),
      ).toEqual(
        Reflect.getMetadata(AUTHORIZE_KEY, CertificationTeamRunsController.prototype.getRun),
      );
    });
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

  describe('getComments', () => {
    it("returns the comments of the team's run", async () => {
      await expect(controller.getComments(2, 7, {})).resolves.toBe(comments);
      expect(runsService.findTeamRun).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 7, teamId: 2 }),
      );
      expect(runsService.findRunComments).toHaveBeenCalledWith(7);
    });

    it("checks certification:read on the run's own tenant", async () => {
      const tenantTenIds = new Set([5]);
      await controller.getComments(2, 7, { [READ]: { 10: tenantTenIds, 11: true } } as never);

      const { validOdsIds } = runsService.findTeamRun.mock.calls[0][0];
      expect(validOdsIds(10)).toBe(tenantTenIds);
      expect(validOdsIds(12)).toBeUndefined();
    });

    it("answers 404 and reads no comments for another team's run", async () => {
      runsService.findTeamRun.mockRejectedValue(new NotFoundException());
      await expect(controller.getComments(3, 7, {})).rejects.toBeInstanceOf(NotFoundException);
      expect(runsService.findRunComments).not.toHaveBeenCalled();
    });

    it('is guarded like getRun', () => {
      expect(
        Reflect.getMetadata(AUTHORIZE_KEY, CertificationTeamRunsController.prototype.getComments),
      ).toEqual(
        Reflect.getMetadata(AUTHORIZE_KEY, CertificationTeamRunsController.prototype.getRun),
      );
    });

    it('is served at :runId/comments', () => {
      expect(
        Reflect.getMetadata(PATH_METADATA, CertificationTeamRunsController.prototype.getComments),
      ).toBe(':runId/comments');
    });
  });

  describe('getEvents', () => {
    it("returns a page of the team's run history", async () => {
      await expect(controller.getEvents(2, 7, 100, 25, {})).resolves.toBe(eventPage);
      expect(runsService.findTeamRun).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 7, teamId: 2 }),
      );
      expect(runsService.findRunEvents).toHaveBeenCalledWith(7, { offset: 100, limit: 25 });
    });

    it('defaults offset to 0 and limit to 50', () => {
      const args = Object.values(
        Reflect.getMetadata(
          ROUTE_ARGS_METADATA,
          CertificationTeamRunsController,
          'getEvents',
        ) as Record<string, { data: unknown; pipes: unknown[] }>,
      );
      const defaultOf = (name: string) =>
        (args.find((arg) => arg.data === name)?.pipes[0] as { defaultValue: unknown }).defaultValue;
      expect(defaultOf('offset')).toBe(0);
      expect(defaultOf('limit')).toBe(50);
    });

    it('accepts the largest limit', async () => {
      await controller.getEvents(2, 7, 0, 200, {});
      expect(runsService.findRunEvents).toHaveBeenCalledWith(7, { offset: 0, limit: 200 });
    });

    it.each([[201], [0], [-1]])('rejects a limit of %d', async (limit) => {
      await expect(controller.getEvents(2, 7, 0, limit, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(runsService.findRunEvents).not.toHaveBeenCalled();
    });

    it('rejects a negative offset', async () => {
      await expect(controller.getEvents(2, 7, -1, 50, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(runsService.findRunEvents).not.toHaveBeenCalled();
    });

    it("checks certification:read on the run's own tenant", async () => {
      const tenantTenIds = new Set([5]);
      await controller.getEvents(2, 7, 0, 50, { [READ]: { 10: tenantTenIds, 11: true } } as never);

      const { validOdsIds } = runsService.findTeamRun.mock.calls[0][0];
      expect(validOdsIds(10)).toBe(tenantTenIds);
      expect(validOdsIds(12)).toBeUndefined();
    });

    it("returns 404 and reads no history for another team's run", async () => {
      runsService.findTeamRun.mockRejectedValue(new NotFoundException());
      await expect(controller.getEvents(3, 7, 0, 50, {})).rejects.toBeInstanceOf(NotFoundException);
      expect(runsService.findRunEvents).not.toHaveBeenCalled();
    });

    it('is guarded like getRun and served at :runId/events', () => {
      const proto = CertificationTeamRunsController.prototype;
      expect(Reflect.getMetadata(AUTHORIZE_KEY, proto.getEvents)).toEqual(
        Reflect.getMetadata(AUTHORIZE_KEY, proto.getRun),
      );
      expect(Reflect.getMetadata(PATH_METADATA, proto.getEvents)).toBe(':runId/events');
    });
  });
});
