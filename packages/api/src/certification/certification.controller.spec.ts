import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { SbEnvironmentEdfiTenantInterceptor } from '../app/sb-environment-edfi-tenant.interceptor';
import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CertificationSupportInterceptor } from './certification-support.interceptor';
import { CertificationController } from './certification.controller';

const READ = 'team.sb-environment.edfi-tenant.ods.certification:read';
const RUN = 'team.sb-environment.edfi-tenant.ods.certification:run';
const subject = { id: '__filtered__', edfiTenantId: 'edfiTenantId', teamId: 'teamId' };
const authorizeOf = (handler: keyof CertificationController) =>
  Reflect.getMetadata(AUTHORIZE_KEY, CertificationController.prototype[handler]);

describe('CertificationController', () => {
  const sbEnvironment = { id: 1 } as never;
  const edfiTenant = { id: 10, name: 'tenant1' } as never;
  const body = { token: 't', inputs: { studentUniqueId: 'S1' } };
  const certificationRun = { certificationRunId: 7, status: 'DRAFT' };
  const validOdsIds = new Set([5]);
  let runsService: { findTeamRun: jest.Mock };

  const make = (service: object = {}, stepRunsService: object = {}) =>
    new CertificationController(service as never, stepRunsService as never, runsService as never);

  const expectTeamRunLookup = () =>
    expect(runsService.findTeamRun).toHaveBeenCalledWith({
      runId: 7,
      teamId: 2,
      edfiTenantId: 10,
      validOdsIds: expect.any(Function),
    });

  beforeEach(() => {
    runsService = { findTeamRun: jest.fn().mockResolvedValue(certificationRun) };
  });

  it("lives under one run of the team's tenant", () => {
    expect(Reflect.getMetadata(PATH_METADATA, CertificationController)).toBe(
      'teams/:teamId/edfi-tenants/:edfiTenantId/certification/runs/:runId',
    );
  });

  it('resolves the environment, then refuses unsupported data models', () => {
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, CertificationController)).toEqual([
      SbEnvironmentEdfiTenantInterceptor,
      CertificationSupportInterceptor,
    ]);
  });

  it("checks the run against the data stores the user's privilege covers", async () => {
    const controller = make({}, { findScenarioStatuses: jest.fn() });

    await controller.getScenarioStatuses(2, edfiTenant, 7, validOdsIds);

    expect(runsService.findTeamRun.mock.calls[0][0].validOdsIds(10)).toBe(validOdsIds);
  });

  describe('runStep', () => {
    it("runs the step on the team's run and serializes the result", async () => {
      const saved = {
        stepId: 101,
        status: 'success',
        ranAt: '2026-10-12T20:00:00.000Z',
        scenarioStatus: 'inprogress',
        errors: [],
      };
      const service = { runStep: jest.fn().mockResolvedValue(saved) };

      const result = await make(service).runStep(
        2,
        sbEnvironment,
        edfiTenant,
        7,
        101,
        body,
        validOdsIds,
        { setHeader: jest.fn() } as never,
      );

      expectTeamRunLookup();
      expect(service.runStep).toHaveBeenCalledWith({
        sbEnvironment,
        edfiTenant,
        certificationRun,
        stepId: 101,
        token: 't',
        inputs: { studentUniqueId: 'S1' },
      });
      expect(result).toEqual(saved);
    });

    it("runs nothing when the run is not the team's", async () => {
      runsService.findTeamRun.mockRejectedValue(new NotFoundException());
      const service = { runStep: jest.fn() };

      await expect(
        make(service).runStep(2, sbEnvironment, edfiTenant, 7, 101, body, validOdsIds, {} as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(service.runStep).not.toHaveBeenCalled();
    });

    it('adds Retry-After when the service is temporarily unavailable', async () => {
      const service = {
        runStep: jest.fn().mockRejectedValue(new ServiceUnavailableException('busy')),
      };
      const res = { setHeader: jest.fn() };

      await expect(
        make(service).runStep(
          2,
          sbEnvironment,
          edfiTenant,
          7,
          101,
          body,
          validOdsIds,
          res as never,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
    });

    it('is guarded by certification:run', () => {
      expect(authorizeOf('runStep')).toEqual({ privilege: RUN, subject });
    });
  });

  describe('sendToReview', () => {
    const dto = { runId: 7, status: 'READY_FOR_REVIEW', canExecuteSteps: false };

    beforeEach(() => {
      runsService = {
        findTeamRun: jest.fn().mockResolvedValue(certificationRun),
        toDto: jest.fn().mockReturnValue(dto),
      } as never;
    });

    it("sends the team's run and returns it with its new status", async () => {
      const service = { sendToReview: jest.fn().mockResolvedValue('READY_FOR_REVIEW') };

      const result = await make(service).sendToReview(2, edfiTenant, 7, validOdsIds, {
        id: 9,
      } as never);

      expectTeamRunLookup();
      expect(runsService.findTeamRun.mock.calls[0][0].validOdsIds(10)).toBe(validOdsIds);
      expect(service.sendToReview).toHaveBeenCalledWith(certificationRun, 9);
      expect((runsService as unknown as { toDto: jest.Mock }).toDto).toHaveBeenCalledWith({
        ...certificationRun,
        status: 'READY_FOR_REVIEW',
      });
      expect(result).toBe(dto);
    });

    it('sendToReview passes the session user id, or null without a session', async () => {
      const service = { sendToReview: jest.fn().mockResolvedValue('READY_FOR_REVIEW') };
      const controller = make(service);

      await controller.sendToReview(2, edfiTenant, 7, validOdsIds, { id: 9 } as never);
      await controller.sendToReview(2, edfiTenant, 7, validOdsIds, undefined);

      expect(service.sendToReview).toHaveBeenNthCalledWith(1, certificationRun, 9);
      expect(service.sendToReview).toHaveBeenNthCalledWith(2, certificationRun, null);
    });

    it('is a 404 for a run outside the data stores the user may run', async () => {
      runsService.findTeamRun.mockRejectedValue(new NotFoundException());
      const service = { sendToReview: jest.fn() };

      await expect(
        make(service).sendToReview(2, edfiTenant, 7, validOdsIds),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(service.sendToReview).not.toHaveBeenCalled();
    });

    it("passes the service's 409 through", async () => {
      const service = { sendToReview: jest.fn().mockRejectedValue(new ConflictException('no')) };

      await expect(
        make(service).sendToReview(2, edfiTenant, 7, validOdsIds),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is a POST to send-to-review, guarded by certification:run', () => {
      const handler = CertificationController.prototype.sendToReview;
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('send-to-review');
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
      expect(authorizeOf('sendToReview')).toEqual({ privilege: RUN, subject });
    });
  });

  describe('getStepRuns', () => {
    it("reads the scenario's results from the team's run", async () => {
      const stepRuns = { scenarioStatus: null, steps: [] };
      const stepRunsService = { findStepRuns: jest.fn().mockResolvedValue(stepRuns) };

      await expect(
        make({}, stepRunsService).getStepRuns(2, edfiTenant, 7, 52, validOdsIds),
      ).resolves.toEqual(stepRuns);
      expectTeamRunLookup();
      expect(stepRunsService.findStepRuns).toHaveBeenCalledWith({
        certificationRunId: 7,
        scenarioId: 52,
      });
    });
  });

  describe('getScenarioStatuses', () => {
    it("reads the statuses of the team's run", async () => {
      const statuses = { run: null, scenarios: [] };
      const stepRunsService = { findScenarioStatuses: jest.fn().mockResolvedValue(statuses) };

      await expect(
        make({}, stepRunsService).getScenarioStatuses(2, edfiTenant, 7, validOdsIds),
      ).resolves.toEqual(statuses);
      expectTeamRunLookup();
      expect(stepRunsService.findScenarioStatuses).toHaveBeenCalledWith(certificationRun);
    });
  });

  describe('getStepSnapshot', () => {
    it("reads the step's snapshot from the team's run", async () => {
      const snapshot = { state: 'none' };
      const stepRunsService = { findStepSnapshot: jest.fn().mockResolvedValue(snapshot) };

      await expect(
        make({}, stepRunsService).getStepSnapshot(2, edfiTenant, 7, 101, validOdsIds),
      ).resolves.toEqual(snapshot);
      expectTeamRunLookup();
      expect(stepRunsService.findStepSnapshot).toHaveBeenCalledWith({
        certificationRunId: 7,
        stepId: 101,
      });
    });

    it('tells browsers and proxies not to keep the decrypted response', () => {
      expect(
        Reflect.getMetadata(HEADERS_METADATA, CertificationController.prototype.getStepSnapshot),
      ).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
    });
  });

  it.each(['getStepRuns', 'getScenarioStatuses', 'getStepSnapshot'] as const)(
    '%s is guarded by certification:read',
    (handler) => {
      expect(authorizeOf(handler)).toEqual({ privilege: READ, subject });
    },
  );
});
