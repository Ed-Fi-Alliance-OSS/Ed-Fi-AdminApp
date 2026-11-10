import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { FindOperator, In, IsNull, Not } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { CertificationStepRunsService } from './certification-step-runs.service';

type Deps = Partial<{
  scenarioRepository: unknown;
  runRepository: unknown;
  runScenarioRepository: unknown;
  stepRunRepository: unknown;
  stepErrorRepository: unknown;
}>;

// Named dependencies instead of five positional arguments; unset ones are empty stubs.
const makeService = (deps: Deps) =>
  new CertificationStepRunsService(
    (deps.scenarioRepository ?? {}) as never,
    (deps.runRepository ?? {}) as never,
    (deps.runScenarioRepository ?? {}) as never,
    (deps.stepRunRepository ?? {}) as never,
    (deps.stepErrorRepository ?? {}) as never,
  );

/** The open-run lookup every read uses: tenant 10's SIS run that isn't Approved or Rejected. */
const openRun = (odsId: number | FindOperator<unknown>) => ({
  edfiTenantId: 10,
  odsId,
  certificationModel: 'SIS',
  status: Not(In(['APPROVED', 'REJECTED'])),
});

describe('CertificationStepRunsService.findStepRuns', () => {
  let scenarioRepository: { findOne: jest.Mock };
  let runRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let runScenarioRepository: { findOne: jest.Mock };
  let stepRunRepository: { find: jest.Mock; findOne: jest.Mock };
  let stepErrorRepository: { find: jest.Mock };
  let service: CertificationStepRunsService;

  const find = (
    overrides: Partial<Parameters<CertificationStepRunsService['findStepRuns']>[0]> = {},
  ) =>
    service.findStepRuns({
      edfiTenantId: 10,
      odsId: 5,
      sisVersion: 'v5',
      scenarioId: 20,
      ...overrides,
    });

  beforeEach(() => {
    scenarioRepository = {
      findOne: jest.fn().mockResolvedValue({
        scenarioId: 20,
        domain: {
          catalogVersionId: 3,
          catalogVersion: { catalogVersionId: 3, dataStandardVersion: 'v5' },
        },
      }),
    };
    runRepository = {
      findOne: jest.fn().mockResolvedValue({ certificationRunId: 7, status: 'DRAFT' }),
      create: jest.fn(),
      save: jest.fn(),
    };
    runScenarioRepository = { findOne: jest.fn().mockResolvedValue({ status: 'failed' }) };
    stepRunRepository = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    stepErrorRepository = { find: jest.fn().mockResolvedValue([]) };
    service = makeService({
      scenarioRepository,
      runRepository,
      runScenarioRepository,
      stepRunRepository,
      stepErrorRepository,
    });
  });

  it("looks up the data store's open SIS run, the same one runStep uses", async () => {
    await find();

    expect(scenarioRepository.findOne).toHaveBeenCalledWith({
      where: { scenarioId: 20 },
      relations: { domain: { catalogVersion: true } },
    });
    expect(runRepository.findOne).toHaveBeenCalledWith({
      where: openRun(5),
    });
  });

  it('returns no steps when the scenario does not exist', async () => {
    scenarioRepository.findOne.mockResolvedValue(null);

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(runRepository.findOne).not.toHaveBeenCalled();
  });

  it("returns no steps when the scenario belongs to another SIS version's catalog", async () => {
    scenarioRepository.findOne.mockResolvedValue({
      scenarioId: 20,
      domain: {
        catalogVersionId: 9,
        catalogVersion: { catalogVersionId: 9, dataStandardVersion: 'v4' },
      },
    });

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(runRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns no steps when the data store has no open run, without creating one', async () => {
    runRepository.findOne.mockResolvedValue(null);

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(runRepository.create).not.toHaveBeenCalled();
    expect(runRepository.save).not.toHaveBeenCalled();
    expect(stepRunRepository.find).not.toHaveBeenCalled();
  });

  it('looks the open run up with IsNull() when no ODS is chosen', async () => {
    await find({ odsId: null });

    expect(runRepository.findOne).toHaveBeenCalledWith({
      where: openRun(IsNull()),
    });
  });

  it('looks the open run up by the chosen ODS', async () => {
    await find();

    expect(runRepository.findOne).toHaveBeenCalledWith({
      where: openRun(5),
    });
  });

  it('returns saved steps with inputs, ISO ranAt and mapped errors', async () => {
    stepRunRepository.find.mockResolvedValue([
      {
        stepRunId: 55,
        stepId: 101,
        status: 'failed',
        runAt: new Date('2026-10-15T15:00:00.000Z'),
        inputs: { studentUniqueId: 'S1' },
        responseStatus: 404,
      },
      {
        stepRunId: 56,
        stepId: 102,
        status: 'success',
        runAt: new Date('2026-10-15T15:05:00.000Z'),
        inputs: null,
        responseStatus: null,
      },
    ]);
    stepErrorRepository.find.mockResolvedValue([
      {
        stepRunId: 55,
        kind: 'exception',
        field: null,
        expected: null,
        observed: 'The API returned HTTP 404 Not Found.',
        message: 'No Student found',
      },
      {
        stepRunId: 55,
        kind: 'assertion',
        field: 'middleName',
        expected: 'Text, not empty',
        observed: null,
        message: null,
      },
    ]);

    await expect(find()).resolves.toEqual({
      scenarioStatus: 'failed',
      steps: [
        {
          stepId: 101,
          status: 'failed',
          ranAt: '2026-10-15T15:00:00.000Z',
          inputs: { studentUniqueId: 'S1' },
          responseStatus: 404,
          errors: [
            {
              kind: 'exception',
              field: null,
              expected: null,
              observed: 'The API returned HTTP 404 Not Found.',
              message: 'No Student found',
            },
            {
              kind: 'assertion',
              field: 'middleName',
              expected: 'Text, not empty',
              observed: null,
              message: null,
            },
          ],
        },
        {
          stepId: 102,
          status: 'success',
          ranAt: '2026-10-15T15:05:00.000Z',
          inputs: null,
          responseStatus: null,
          errors: [],
        },
      ],
    });
    expect(stepRunRepository.find).toHaveBeenCalledWith({
      where: { certificationRunId: 7, scenarioId: 20 },
    });
    expect(stepErrorRepository.find).toHaveBeenCalledWith({
      where: { stepRunId: In([55, 56]) },
      order: { errorId: 'ASC' },
    });
    expect(runScenarioRepository.findOne).toHaveBeenCalledWith({
      where: { certificationRunId: 7, scenarioId: 20 },
    });
  });

  it('returns a null scenario status and skips the error lookup when no step of the scenario ran', async () => {
    runScenarioRepository.findOne.mockResolvedValue(null);

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(stepErrorRepository.find).not.toHaveBeenCalled();
  });

  it('rejects an unsupported SIS version', async () => {
    await expect(find({ sisVersion: 'v4' })).rejects.toBeInstanceOf(ValidationHttpException);
    expect(scenarioRepository.findOne).not.toHaveBeenCalled();
  });
});

describe('CertificationStepRunsService.findScenarioStatuses', () => {
  let scenarioRepository: { findOne: jest.Mock };
  let runRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let runScenarioRepository: { find: jest.Mock };
  let stepRunRepository: { find: jest.Mock };
  let stepErrorRepository: { find: jest.Mock };
  let service: CertificationStepRunsService;

  const findStatuses = (
    overrides: Partial<Parameters<CertificationStepRunsService['findScenarioStatuses']>[0]> = {},
  ) =>
    service.findScenarioStatuses({
      edfiTenantId: 10,
      odsId: 5,
      sisVersion: 'v5',
      ...overrides,
    });

  beforeEach(() => {
    scenarioRepository = { findOne: jest.fn() };
    runRepository = {
      findOne: jest.fn().mockResolvedValue({ certificationRunId: 7, status: 'DRAFT' }),
      create: jest.fn(),
      save: jest.fn(),
    };
    runScenarioRepository = {
      find: jest.fn().mockResolvedValue([
        { scenarioId: 1, status: 'completed' },
        { scenarioId: 2, status: 'failed' },
      ]),
    };
    stepRunRepository = { find: jest.fn() };
    stepErrorRepository = { find: jest.fn() };
    service = makeService({
      scenarioRepository,
      runRepository,
      runScenarioRepository,
      stepRunRepository,
      stepErrorRepository,
    });
  });

  it('returns the open run with canExecuteSteps and its scenario statuses', async () => {
    await expect(findStatuses()).resolves.toEqual({
      run: { runId: 7, status: 'DRAFT', canExecuteSteps: true },
      scenarios: [
        { scenarioId: 1, status: 'completed' },
        { scenarioId: 2, status: 'failed' },
      ],
    });
    expect(runRepository.findOne).toHaveBeenCalledWith({ where: openRun(5) });
    expect(runScenarioRepository.find).toHaveBeenCalledWith({
      where: { certificationRunId: 7 },
    });
    expect(runRepository.create).not.toHaveBeenCalled();
    expect(runRepository.save).not.toHaveBeenCalled();
  });

  it.each(['READY_FOR_REVIEW', 'IN_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES'])(
    'says steps cannot run while the run is %s',
    async (status) => {
      runRepository.findOne.mockResolvedValue({ certificationRunId: 7, status });
      await expect(findStatuses()).resolves.toMatchObject({
        run: { runId: 7, status, canExecuteSteps: false },
      });
    },
  );

  it('says steps can run while the run is Changes requested', async () => {
    runRepository.findOne.mockResolvedValue({ certificationRunId: 7, status: 'CHANGES_REQUESTED' });
    await expect(findStatuses()).resolves.toMatchObject({
      run: { status: 'CHANGES_REQUESTED', canExecuteSteps: true },
    });
  });

  it('returns no run and no statuses when the data store has no open run', async () => {
    // Also the case when its only run is Approved or Rejected: that run isn't open.
    runRepository.findOne.mockResolvedValue(null);

    await expect(findStatuses()).resolves.toEqual({ run: null, scenarios: [] });
    expect(runScenarioRepository.find).not.toHaveBeenCalled();
  });

  it('omits scenarios without a row', async () => {
    runScenarioRepository.find.mockResolvedValue([{ scenarioId: 2, status: 'inprogress' }]);

    await expect(findStatuses()).resolves.toMatchObject({
      scenarios: [{ scenarioId: 2, status: 'inprogress' }],
    });
  });

  it('queries odsId IsNull() when odsId is null', async () => {
    await findStatuses({ odsId: null });

    expect(runRepository.findOne).toHaveBeenCalledWith({
      where: openRun(IsNull()),
    });
  });

  it('queries the given odsId when provided', async () => {
    await findStatuses({ odsId: 5 });

    expect(runRepository.findOne).toHaveBeenCalledWith({
      where: openRun(5),
    });
  });

  it('throws the unsupportedVersion validation error for an unsupported sisVersion', async () => {
    await expect(findStatuses({ sisVersion: 'v4' })).rejects.toBeInstanceOf(
      ValidationHttpException,
    );
    expect(runRepository.findOne).not.toHaveBeenCalled();
  });
});

describe('CertificationStepRunsService.findStepSnapshot', () => {
  let stepRunRepository: { findOne: jest.Mock };
  let service: CertificationStepRunsService;

  const findSnapshot = () =>
    service.findStepSnapshot({ edfiTenantId: 10, odsId: 5, sisVersion: 'v5', stepId: 101 });

  beforeEach(() => {
    stepRunRepository = { findOne: jest.fn() };
    service = makeService({ stepRunRepository });
  });

  it("reads only this data store's open run of the step, selecting the hidden snapshot column", async () => {
    stepRunRepository.findOne.mockResolvedValue({ responseStatus: 200, responseSnapshot: null });

    await findSnapshot();

    expect(stepRunRepository.findOne).toHaveBeenCalledWith({
      where: { stepId: 101, certificationRun: openRun(5) },
      select: { stepRunId: true, responseStatus: true, responseSnapshot: true },
    });
  });

  it('looks the run up with IsNull() when no ODS is chosen', async () => {
    stepRunRepository.findOne.mockResolvedValue({ responseStatus: null, responseSnapshot: null });

    await service.findStepSnapshot({
      edfiTenantId: 10,
      odsId: null,
      sisVersion: 'v5',
      stepId: 101,
    });

    expect(stepRunRepository.findOne.mock.calls[0][0].where.certificationRun).toEqual(
      openRun(IsNull()),
    );
  });

  it('returns a stored body', async () => {
    stepRunRepository.findOne.mockResolvedValue({
      responseStatus: 200,
      responseSnapshot: { state: 'body', body: '[]' },
    });

    await expect(findSnapshot()).resolves.toEqual({ state: 'body', body: '[]' });
  });

  it('returns the size of a body that was too large to keep', async () => {
    stepRunRepository.findOne.mockResolvedValue({
      responseStatus: 200,
      responseSnapshot: { state: 'tooLarge', sizeBytes: 81234 },
    });

    await expect(findSnapshot()).resolves.toEqual({ state: 'tooLarge', sizeBytes: 81234 });
  });

  it('returns none when the request was never sent', async () => {
    stepRunRepository.findOne.mockResolvedValue({ responseStatus: null, responseSnapshot: null });

    await expect(findSnapshot()).resolves.toEqual({ state: 'none' });
  });

  it('returns deleted when a response was received but its snapshot was cleared', async () => {
    stepRunRepository.findOne.mockResolvedValue({ responseStatus: 404, responseSnapshot: null });

    await expect(findSnapshot()).resolves.toEqual({ state: 'deleted' });
  });

  it('throws NotFound when the step never ran for this tenant and ODS', async () => {
    stepRunRepository.findOne.mockResolvedValue(null);

    await expect(findSnapshot()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unsupported SIS version', async () => {
    await expect(
      service.findStepSnapshot({ edfiTenantId: 10, odsId: 5, sisVersion: 'v4', stepId: 101 }),
    ).rejects.toBeInstanceOf(ValidationHttpException);
    expect(stepRunRepository.findOne).not.toHaveBeenCalled();
  });
});
