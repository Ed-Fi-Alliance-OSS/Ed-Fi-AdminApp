import 'reflect-metadata';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { In, IsNull, Not } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { CertificationRunsService } from './certification-runs.service';
import { CERT_RUN_MESSAGES } from './certification.service';

const sbEnvironment = { id: 1, displayName: 'Env One', odsDsVersion: '5.0.0' } as never;
const edfiTenant = { id: 10, name: 'tenant1', displayName: 'tenant1', sbEnvironmentId: 1 } as never;
const ods = { id: 5, edfiTenantId: 10, displayName: 'ods-five' };
const catalogVersion = { catalogVersionId: 3, dataStandardVersion: 'v5' };

const storedRun = (overrides: object = {}) => ({
  certificationRunId: 7,
  teamId: 2,
  edfiTenantId: 10,
  odsId: 5,
  certificationModel: 'SIS',
  status: 'DRAFT',
  catalogVersion,
  ods,
  edfiTenant: { ...(edfiTenant as object), sbEnvironment },
  ...overrides,
});

describe('CertificationRunsService', () => {
  let runRepository: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let odsRepository: { findOneBy: jest.Mock };
  let catalogVersionRepository: { findOne: jest.Mock };
  let commentRepository: { find: jest.Mock };
  let scenarioRepository: { createQueryBuilder: jest.Mock };
  let runScenarioRepository: { createQueryBuilder: jest.Mock };
  let artifactService: { currentRef: string | undefined };
  let service: CertificationRunsService;

  const create = (overrides: object = {}) =>
    service.createRun({
      teamId: 2,
      sbEnvironment,
      edfiTenant,
      odsId: 5,
      certificationModel: 'SIS',
      userId: 42,
      ...overrides,
    });

  beforeEach(() => {
    runRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ certificationRunId: 7, ...value })),
    };
    odsRepository = { findOneBy: jest.fn().mockResolvedValue(ods) };
    catalogVersionRepository = { findOne: jest.fn().mockResolvedValue(catalogVersion) };
    commentRepository = { find: jest.fn() };
    scenarioRepository = { createQueryBuilder: jest.fn() };
    runScenarioRepository = { createQueryBuilder: jest.fn() };
    artifactService = { currentRef: 'v2.1.0' };
    service = new CertificationRunsService(
      artifactService as never,
      runRepository as never,
      odsRepository as never,
      catalogVersionRepository as never,
      commentRepository as never,
      scenarioRepository as never,
      runScenarioRepository as never,
    );
  });

  describe('findTeamRunHistory', () => {
    const allowAll = () => new Set([5, 6]) as never;
    /** A query builder whose every call chains and whose getRawMany resolves `rows`. */
    const rawBuilder = (rows: object[]) => {
      const builder: Record<string, jest.Mock> = {};
      for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'groupBy']) {
        builder[method] = jest.fn().mockReturnValue(builder);
      }
      builder.getRawMany = jest.fn().mockResolvedValue(rows);
      return builder;
    };
    const historyRun = (overrides: object = {}) =>
      storedRun({
        createdAt: new Date('2026-09-07T13:00:00.000Z'),
        catalogVersionId: 3,
        ...overrides,
      });
    const withCounts = (totals: object[], completed: object[]) => {
      scenarioRepository.createQueryBuilder.mockReturnValue(rawBuilder(totals));
      runScenarioRepository.createQueryBuilder.mockReturnValue(rawBuilder(completed));
    };

    it('reads the team runs that have a data store, newest first', async () => {
      withCounts([], []);
      await service.findTeamRunHistory({ teamId: 2, validOdsIds: allowAll });
      expect(runRepository.find).toHaveBeenCalledWith({
        where: { teamId: 2, odsId: Not(IsNull()) },
        relations: { ods: true, edfiTenant: { sbEnvironment: true } },
        order: { certificationRunId: 'DESC' },
      });
    });

    it('keeps the order the database gave and maps each run to a row', async () => {
      runRepository.find.mockResolvedValue([
        historyRun({ certificationRunId: 9 }),
        historyRun({ certificationRunId: 3 }),
      ]);
      withCounts([], []);
      const rows = await service.findTeamRunHistory({ teamId: 2, validOdsIds: allowAll });
      expect(rows.map((row) => row.runId)).toEqual([9, 3]);
      expect(rows[0]).toEqual({
        runId: 9,
        edfiTenantId: 10,
        odsId: 5,
        environmentName: 'Env One',
        tenantName: 'tenant1',
        dataStoreName: 'ods-five',
        certificationModel: 'SIS',
        status: 'DRAFT',
        createdAt: '2026-09-07T13:00:00.000Z',
        completedScenarios: 0,
        totalScenarios: 0,
      });
    });

    it('leaves out runs on data stores the user may not read', async () => {
      runRepository.find.mockResolvedValue([
        historyRun({ certificationRunId: 9, odsId: 5 }),
        historyRun({ certificationRunId: 8, odsId: 99 }),
        historyRun({ certificationRunId: 7, odsId: 5, edfiTenantId: 11 }),
      ]);
      withCounts([], []);
      const rows = await service.findTeamRunHistory({
        teamId: 2,
        validOdsIds: (edfiTenantId) => (edfiTenantId === 10 ? (new Set([5]) as never) : undefined),
      });
      expect(rows.map((row) => row.runId)).toEqual([9]);
    });

    it('returns [] without counting when no run is readable', async () => {
      runRepository.find.mockResolvedValue([historyRun()]);
      await expect(
        service.findTeamRunHistory({ teamId: 2, validOdsIds: () => undefined }),
      ).resolves.toEqual([]);
      expect(scenarioRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(runScenarioRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('counts completed and total enabled scenarios, coercing pgsql string counts', async () => {
      runRepository.find.mockResolvedValue([historyRun({ certificationRunId: 9 })]);
      withCounts([{ catalogVersionId: 3, total: '30' }], [{ runId: 9, completed: '12' }]);
      const [row] = await service.findTeamRunHistory({ teamId: 2, validOdsIds: allowAll });
      expect(row).toMatchObject({ completedScenarios: 12, totalScenarios: 30 });
    });

    it('only counts enabled scenarios in enabled domains', async () => {
      runRepository.find.mockResolvedValue([historyRun()]);
      const totals = rawBuilder([]);
      const completed = rawBuilder([]);
      scenarioRepository.createQueryBuilder.mockReturnValue(totals);
      runScenarioRepository.createQueryBuilder.mockReturnValue(completed);
      await service.findTeamRunHistory({ teamId: 2, validOdsIds: allowAll });
      const totalsWhere = totals.where.mock.calls[0][0] as string;
      const completedWhere = completed.where.mock.calls[0][0] as string;
      for (const where of [totalsWhere, completedWhere]) {
        expect(where).toContain('scenario.isEnabled = :enabled');
        expect(where).toContain('domain.isEnabled = :enabled');
      }
      expect(completedWhere).toContain('status = :status');
    });

    it("counts a run's completed rows only against its own catalog, selected by team and not by an ID list", async () => {
      runRepository.find.mockResolvedValue([historyRun()]);
      const completed = rawBuilder([]);
      scenarioRepository.createQueryBuilder.mockReturnValue(rawBuilder([]));
      runScenarioRepository.createQueryBuilder.mockReturnValue(completed);
      await service.findTeamRunHistory({ teamId: 2, validOdsIds: allowAll });
      const where = completed.where.mock.calls[0][0] as string;
      const parameters = completed.where.mock.calls[0][1] as Record<string, unknown>;
      expect(where).toContain('run.catalogVersionId = domain.catalogVersionId');
      expect(where).toContain('run.teamId = :teamId');
      expect(parameters).toMatchObject({ teamId: 2, status: 'completed' });
      expect(parameters).not.toHaveProperty('runIds');
    });

    it('reports 0 / 0 for a run without a catalog version', async () => {
      runRepository.find.mockResolvedValue([historyRun({ catalogVersionId: null })]);
      withCounts([], []);
      const [row] = await service.findTeamRunHistory({ teamId: 2, validOdsIds: allowAll });
      expect(row).toMatchObject({ completedScenarios: 0, totalScenarios: 0 });
    });
  });

  describe('findRunComments', () => {
    it('reads only comments with text, joined to the author, newest first with a stable tie-break', async () => {
      commentRepository.find.mockResolvedValue([]);
      await service.findRunComments(7);
      expect(commentRepository.find).toHaveBeenCalledWith({
        where: { certificationRunId: 7, text: Not(IsNull()) },
        relations: { author: true },
        order: { createdAt: 'DESC', certificationRunCommentId: 'DESC' },
      });
    });

    it('maps each comment, resolving the reviewer name at read time', async () => {
      const createdAt = new Date('2026-11-19T15:00:00Z');
      commentRepository.find.mockResolvedValue([
        {
          certificationRunCommentId: 3,
          createdAt,
          decision: 'REJECTED',
          text: 'Missing grades',
          author: { displayName: 'Ana Ruiz' },
        },
        {
          certificationRunCommentId: 1,
          createdAt,
          decision: 'CHANGES_REQUESTED',
          text: 'Fix X',
          author: { displayName: 'jdoe' },
        },
      ]);
      await expect(service.findRunComments(7)).resolves.toEqual([
        {
          commentId: 3,
          createdAt: createdAt.toISOString(),
          reviewerName: 'Ana Ruiz',
          decision: 'REJECTED',
          text: 'Missing grades',
        },
        {
          commentId: 1,
          createdAt: createdAt.toISOString(),
          reviewerName: 'jdoe',
          decision: 'CHANGES_REQUESTED',
          text: 'Fix X',
        },
      ]);
    });

    it('names a deleted reviewer "Former reviewer"', async () => {
      commentRepository.find.mockResolvedValue([
        {
          certificationRunCommentId: 2,
          createdAt: new Date(),
          decision: 'APPROVED',
          text: 'Nice',
          author: null,
        },
      ]);
      const [comment] = await service.findRunComments(7);
      expect(comment.reviewerName).toBe('Former reviewer');
    });

    it('returns an empty list when the run has no comments with text', async () => {
      commentRepository.find.mockResolvedValue([]);
      await expect(service.findRunComments(7)).resolves.toEqual([]);
    });
  });

  describe('createRun', () => {
    it('creates a Draft run for the team, user, data store and current catalog', async () => {
      const dto = await create();

      expect(runRepository.save).toHaveBeenCalledWith({
        edfiTenantId: 10,
        odsId: 5,
        certificationModel: 'SIS',
        catalogVersionId: 3,
        createdById: 42,
        teamId: 2,
        status: 'DRAFT',
      });
      expect(dto).toEqual({
        runId: 7,
        sbEnvironmentId: 1,
        edfiTenantId: 10,
        odsId: 5,
        environmentName: 'Env One',
        tenantName: 'tenant1',
        dataStoreName: 'ods-five',
        certificationModel: 'SIS',
        status: 'DRAFT',
        canExecuteSteps: true,
        dataStandardVersion: 'v5',
      });
    });

    it('looks for the data store inside the tenant and for the loaded, active catalog of the environment’s data standard', async () => {
      await create();

      expect(odsRepository.findOneBy).toHaveBeenCalledWith({ id: 5, edfiTenantId: 10 });
      expect(catalogVersionRepository.findOne).toHaveBeenCalledWith({
        where: { isActive: true, artifactVersion: 'v2.1.0', dataStandardVersion: 'v5' },
        order: { catalogVersionId: 'DESC' },
      });
    });

    it('refuses an environment whose data standard has no catalog, even when another is loaded', async () => {
      // Nothing for v6, but a v5 catalog is loaded.
      catalogVersionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(catalogVersion);

      const result = create({ sbEnvironment: { ...(sbEnvironment as object), odsDsVersion: '6.1.0' } });

      await expect(result).rejects.toThrow(ValidationHttpException);
      expect(catalogVersionRepository.findOne.mock.calls[0][0].where.dataStandardVersion).toBe('v6');
      expect(runRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a second open run of the same model on the data store', async () => {
      runRepository.findOne.mockResolvedValue(storedRun());

      await expect(create()).rejects.toThrow(ConflictException);
      await expect(create()).rejects.toThrow('A SIS run is already open for this data store.');
      expect(runRepository.findOne).toHaveBeenCalledWith({
        where: {
          edfiTenantId: 10,
          odsId: 5,
          certificationModel: 'SIS',
          status: Not(In(['APPROVED', 'REJECTED'])),
        },
      });
      expect(runRepository.save).not.toHaveBeenCalled();
    });

    it('answers the same 409 when another request wins the insert', async () => {
      runRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(storedRun());
      runRepository.save.mockRejectedValue(new Error('duplicate key'));

      await expect(create()).rejects.toThrow(CERT_RUN_MESSAGES.alreadyOpen('SIS'));
    });

    it('rethrows an insert failure that is not a duplicate open run', async () => {
      runRepository.save.mockRejectedValue(new Error('connection lost'));

      await expect(create()).rejects.toThrow('connection lost');
    });

    it('refuses a data store that is not in the tenant', async () => {
      odsRepository.findOneBy.mockResolvedValue(null);

      await expect(create()).rejects.toThrow(NotFoundException);
      expect(runRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a Certification Model that is not available yet', async () => {
      await expect(create({ certificationModel: 'MTSS' })).rejects.toThrow(ValidationHttpException);
      expect(runRepository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['no catalog matches the loaded artifact', () => catalogVersionRepository.findOne.mockResolvedValue(null)],
      ['the artifact is not loaded', () => (artifactService.currentRef = undefined)],
    ])('answers 503 and creates nothing when %s', async (_name, arrange) => {
      arrange();

      await expect(create()).rejects.toThrow(ServiceUnavailableException);
      expect(runRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findLatestRuns', () => {
    it('returns the newest run of each model, and whether it is open', async () => {
      const newest: Record<string, object> = {
        SIS: { certificationRunId: 9, certificationModel: 'SIS', status: 'REJECTED' },
        MTSS: { certificationRunId: 8, certificationModel: 'MTSS', status: 'IN_REVIEW' },
      };
      // One lookup per model; ASSESSMENTS has no run.
      runRepository.findOne.mockImplementation(
        async ({ where }) => newest[where.certificationModel] ?? null,
      );

      expect(await service.findLatestRuns({ edfiTenantId: 10, odsId: 5 })).toEqual([
        { certificationModel: 'SIS', runId: 9, status: 'REJECTED', isOpen: false },
        { certificationModel: 'MTSS', runId: 8, status: 'IN_REVIEW', isOpen: true },
      ]);
      expect(runRepository.findOne).toHaveBeenCalledTimes(3);
      expect(runRepository.findOne).toHaveBeenCalledWith({
        where: { edfiTenantId: 10, odsId: 5, certificationModel: 'SIS' },
        order: { certificationRunId: 'DESC' },
      });
      expect(runRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findTeamRun', () => {
    const find = (overrides: { edfiTenantId?: number; validOdsIds?: unknown } = {}) =>
      service.findTeamRun({
        runId: 7,
        teamId: 2,
        ...overrides,
        // Only tenant 10's data stores are covered, as the auth cache would say.
        validOdsIds: (edfiTenantId) =>
          edfiTenantId === 10
            ? (('validOdsIds' in overrides ? overrides.validOdsIds : new Set([5])) as never)
            : undefined,
      });

    it("returns the team's run with what the pages need", async () => {
      runRepository.findOne.mockResolvedValue(storedRun());

      expect(await find({ edfiTenantId: 10 })).toMatchObject({ certificationRunId: 7 });
      expect(runRepository.findOne).toHaveBeenCalledWith({
        where: { certificationRunId: 7, teamId: 2, edfiTenantId: 10 },
        relations: { catalogVersion: true, ods: true, edfiTenant: { sbEnvironment: true } },
      });
    });

    it('does not filter by tenant when none is given', async () => {
      runRepository.findOne.mockResolvedValue(storedRun());

      await find();

      expect(runRepository.findOne.mock.calls[0][0].where).toEqual({
        certificationRunId: 7,
        teamId: 2,
      });
    });

    it('allows any data store when the privilege covers them all', async () => {
      runRepository.findOne.mockResolvedValue(storedRun());

      await expect(find({ validOdsIds: true })).resolves.toBeDefined();
    });

    it.each([
      ['the run is not found for the team and tenant', null, new Set([5])],
      ['the data store is outside the privilege', storedRun(), new Set([6])],
      ['the user has no privilege on the tenant', storedRun(), undefined],
      ['the run has no data store', storedRun({ odsId: null }), true],
    ])('answers 404 when %s', async (_name, row, validOdsIds) => {
      runRepository.findOne.mockResolvedValue(row);

      await expect(find({ validOdsIds })).rejects.toThrow(NotFoundException);
    });
  });
});
