import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { CertificationStepRunsService } from './certification-step-runs.service';

type Deps = Partial<{
  runScenarioRepository: unknown;
  stepRunRepository: unknown;
  stepErrorRepository: unknown;
}>;

// Named dependencies instead of positional arguments; unset ones are empty stubs.
const makeService = (deps: Deps) =>
  new CertificationStepRunsService(
    (deps.runScenarioRepository ?? {}) as never,
    (deps.stepRunRepository ?? {}) as never,
    (deps.stepErrorRepository ?? {}) as never,
  );

describe('CertificationStepRunsService.findStepRuns', () => {
  let runScenarioRepository: { findOne: jest.Mock };
  let stepRunRepository: { find: jest.Mock; findOne: jest.Mock };
  let stepErrorRepository: { find: jest.Mock };
  let service: CertificationStepRunsService;

  const find = (
    overrides: Partial<Parameters<CertificationStepRunsService['findStepRuns']>[0]> = {},
  ) =>
    service.findStepRuns({ certificationRunId: 7, scenarioId: 20, ...overrides });

  beforeEach(() => {
    runScenarioRepository = { findOne: jest.fn().mockResolvedValue({ status: 'failed' }) };
    stepRunRepository = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    stepErrorRepository = { find: jest.fn().mockResolvedValue([]) };
    service = makeService({ runScenarioRepository, stepRunRepository, stepErrorRepository });
  });

  it("reads the given run's rows of the scenario", async () => {
    await find();

    expect(stepRunRepository.find).toHaveBeenCalledWith({
      where: { certificationRunId: 7, scenarioId: 20 },
    });
    expect(runScenarioRepository.findOne).toHaveBeenCalledWith({
      where: { certificationRunId: 7, scenarioId: 20 },
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

});

describe('CertificationStepRunsService.findScenarioStatuses', () => {
  let runScenarioRepository: { find: jest.Mock };
  let stepRunRepository: { find: jest.Mock };
  let stepErrorRepository: { find: jest.Mock };
  let service: CertificationStepRunsService;

  const findStatuses = (status = 'DRAFT') =>
    service.findScenarioStatuses({ certificationRunId: 7, status } as never);

  beforeEach(() => {
    runScenarioRepository = {
      find: jest.fn().mockResolvedValue([
        { scenarioId: 1, status: 'completed' },
        { scenarioId: 2, status: 'failed' },
      ]),
    };
    stepRunRepository = { find: jest.fn() };
    stepErrorRepository = { find: jest.fn() };
    service = makeService({ runScenarioRepository, stepRunRepository, stepErrorRepository });
  });

  it('returns the run with canExecuteSteps and its scenario statuses', async () => {
    await expect(findStatuses()).resolves.toEqual({
      run: { runId: 7, status: 'DRAFT', canExecuteSteps: true },
      scenarios: [
        { scenarioId: 1, status: 'completed' },
        { scenarioId: 2, status: 'failed' },
      ],
    });
    expect(runScenarioRepository.find).toHaveBeenCalledWith({
      where: { certificationRunId: 7 },
    });
  });

  it.each(['READY_FOR_REVIEW', 'IN_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES', 'APPROVED'])(
    'says steps cannot run while the run is %s',
    async (status) => {
      await expect(findStatuses(status)).resolves.toMatchObject({
        run: { runId: 7, status, canExecuteSteps: false },
      });
    },
  );

  it('says steps can run while the run is Changes requested', async () => {
    await expect(findStatuses('CHANGES_REQUESTED')).resolves.toMatchObject({
      run: { status: 'CHANGES_REQUESTED', canExecuteSteps: true },
    });
  });

  it('omits scenarios without a row', async () => {
    runScenarioRepository.find.mockResolvedValue([{ scenarioId: 2, status: 'inprogress' }]);

    await expect(findStatuses()).resolves.toMatchObject({
      scenarios: [{ scenarioId: 2, status: 'inprogress' }],
    });
  });

});

describe('CertificationStepRunsService.findStepSnapshot', () => {
  let stepRunRepository: { findOne: jest.Mock };
  let service: CertificationStepRunsService;

  const findSnapshot = () =>
    service.findStepSnapshot({ certificationRunId: 7, stepId: 101 });

  beforeEach(() => {
    stepRunRepository = { findOne: jest.fn() };
    service = makeService({ stepRunRepository });
  });

  it("reads only the given run's result of the step, selecting the hidden snapshot column", async () => {
    stepRunRepository.findOne.mockResolvedValue({ responseStatus: 200, responseSnapshot: null });

    await findSnapshot();

    expect(stepRunRepository.findOne).toHaveBeenCalledWith({
      where: { stepId: 101, certificationRunId: 7 },
      select: { stepRunId: true, responseStatus: true, responseSnapshot: true },
    });
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

  it('throws NotFound when the step never ran in this run', async () => {
    stepRunRepository.findOne.mockResolvedValue(null);

    await expect(findSnapshot()).rejects.toBeInstanceOf(NotFoundException);
  });
});
