import 'reflect-metadata';
import { CERT_REVIEW_MESSAGES } from '@edanalytics/models';
import {
  CertificationRun,
  CertificationRunComment,
  ScenarioStep,
} from '@edanalytics/models-server';
import { NotFoundException } from '@nestjs/common';
import { ValidationHttpException } from '../utils';
import { CertificationReviewService } from './certification-review.service';
import { CERT_RUN_MESSAGES } from './certification.service';

type Deps = Partial<{
  stepRunsService: unknown;
  runRepository: unknown;
  domainRepository: unknown;
  scenarioRepository: unknown;
  stepRepository: unknown;
  runScenarioRepository: unknown;
  stepRunRepository: unknown;
  stepErrorRepository: unknown;
  dataSource: unknown;
}>;

// Named dependencies instead of positional arguments; unset ones are empty stubs.
const makeService = (deps: Deps) =>
  new CertificationReviewService(
    (deps.stepRunsService ?? {}) as never,
    (deps.runRepository ?? {}) as never,
    (deps.domainRepository ?? {}) as never,
    (deps.scenarioRepository ?? {}) as never,
    (deps.stepRepository ?? {}) as never,
    (deps.runScenarioRepository ?? {}) as never,
    (deps.stepRunRepository ?? {}) as never,
    (deps.stepErrorRepository ?? {}) as never,
    (deps.dataSource ?? {}) as never,
  );

/** A transaction that undoes the run's status change when its callback throws. */
const makeTransactionalDb = (initialStatus: string) => {
  const state = { status: initialStatus, comments: [] as unknown[] };
  const runUpdate = jest.fn(async (where: { status: string }, set: { status: string }) => {
    if (where.status !== state.status) return { affected: 0 };
    state.status = set.status;
    return { affected: 1 };
  });
  const commentSave = jest.fn(async (value: unknown) => {
    state.comments.push(value);
    return value;
  });
  const snapshotUpdate = jest.fn().mockResolvedValue({ affected: 2 });
  const em: Record<string, Record<string, jest.Mock>> = {
    [CertificationRun.name]: { update: runUpdate },
    [CertificationRunComment.name]: { create: jest.fn((value) => value), save: commentSave },
    [ScenarioStep.name]: { update: snapshotUpdate },
  };
  const dataSource = {
    transaction: jest.fn(async (work) => {
      const before = { status: state.status, comments: [...state.comments] };
      try {
        return await work({ getRepository: (entity: { name: string }) => em[entity.name] });
      } catch (error) {
        state.status = before.status;
        state.comments = before.comments;
        throw error;
      }
    }),
  };
  return { state, runUpdate, commentSave, snapshotUpdate, dataSource };
};

/** A read-only transaction: its repositories are the injected ones, and it says when it's open. */
const makeReadTransaction = () => {
  const em = { withRepository: jest.fn((repository: unknown) => repository) };
  const dataSource = { transaction: jest.fn(async (work) => work(em)) };
  return { em, dataSource };
};

const LOCKED_RUN_READ = {
  where: { certificationRunId: 7 },
  select: { certificationRunId: true, status: true },
  lock: { mode: 'pessimistic_read' },
};

describe('CertificationReviewService.pickUp', () => {
  let runRepository: { findOne: jest.Mock };
  let db: ReturnType<typeof makeTransactionalDb>;
  let service: CertificationReviewService;

  const setUp = (status: string | null) => {
    db = makeTransactionalDb(status ?? 'DRAFT');
    runRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue(status === null ? null : { certificationRunId: 7, status }),
    };
    service = makeService({ runRepository, dataSource: db.dataSource });
  };

  it.each(['READY_FOR_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES'])(
    'moves a %s run to IN_REVIEW',
    async (from) => {
      setUp(from);
      await expect(service.pickUp(7)).resolves.toEqual({ runId: 7, status: 'IN_REVIEW' });
      expect(db.runUpdate).toHaveBeenCalledWith(
        { certificationRunId: 7, status: from },
        expect.objectContaining({ status: 'IN_REVIEW', statusChangedAt: expect.any(Date) }),
      );
      expect(db.state.status).toBe('IN_REVIEW');
    },
  );

  it('refuses an IN_REVIEW run with 409 without opening a transaction', async () => {
    setUp('IN_REVIEW');
    await expect(service.pickUp(7)).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.invalidTransition,
    });
    expect(db.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('returns 404 for a run that does not exist', async () => {
    setUp(null);
    await expect(service.pickUp(7)).rejects.toThrow(NotFoundException);
  });

  it('returns 409 when another reviewer picked the run up first', async () => {
    setUp('READY_FOR_REVIEW');
    db.runUpdate.mockResolvedValue({ affected: 0 });
    await expect(service.pickUp(7)).rejects.toMatchObject({ status: 409 });
  });
});

describe('CertificationReviewService.decide', () => {
  let runRepository: { findOne: jest.Mock };
  let db: ReturnType<typeof makeTransactionalDb>;
  let service: CertificationReviewService;

  beforeEach(() => {
    db = makeTransactionalDb('IN_REVIEW');
    runRepository = {
      findOne: jest.fn().mockResolvedValue({ certificationRunId: 7, status: 'IN_REVIEW' }),
    };
    service = makeService({ runRepository, dataSource: db.dataSource });
  });

  it('approves without a comment and clears the response snapshots', async () => {
    await expect(service.decide({ runId: 7, decision: 'APPROVED', userId: 5 })).resolves.toEqual({
      runId: 7,
      status: 'APPROVED',
    });
    expect(db.runUpdate).toHaveBeenCalledWith(
      { certificationRunId: 7, status: 'IN_REVIEW' },
      expect.objectContaining({ status: 'APPROVED' }),
    );
    expect(db.commentSave).toHaveBeenCalledWith({
      certificationRunId: 7,
      authorId: 5,
      decision: 'APPROVED',
      text: null,
    });
    expect(db.snapshotUpdate).toHaveBeenCalledWith(
      { certificationRunId: 7 },
      { responseSnapshot: null },
    );
  });

  it('rejects with a comment and clears the response snapshots', async () => {
    await expect(
      service.decide({ runId: 7, decision: 'REJECTED', comment: 'Missing data', userId: 5 }),
    ).resolves.toEqual({ runId: 7, status: 'REJECTED' });
    expect(db.commentSave).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'REJECTED', text: 'Missing data' }),
    );
    expect(db.snapshotUpdate).toHaveBeenCalledWith(
      { certificationRunId: 7 },
      { responseSnapshot: null },
    );
  });

  it('requests changes and keeps the response snapshots', async () => {
    await expect(
      service.decide({ runId: 7, decision: 'CHANGES_REQUESTED', comment: 'Fix it', userId: 5 }),
    ).resolves.toEqual({ runId: 7, status: 'CHANGES_REQUESTED' });
    expect(db.commentSave).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'CHANGES_REQUESTED', text: 'Fix it' }),
    );
    expect(db.snapshotUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['REJECTED', '   '],
    ['REJECTED', undefined],
    ['CHANGES_REQUESTED', ''],
  ] as const)('refuses %s with comment %p with 400 on comment', async (decision, comment) => {
    const result = service.decide({ runId: 7, decision, comment, userId: 5 });
    await expect(result).rejects.toThrow(ValidationHttpException);
    const error = await result.catch((e: ValidationHttpException) => e);
    expect((error as ValidationHttpException).getStatus()).toBe(400);
    expect(JSON.stringify((error as ValidationHttpException).getResponse())).toContain(
      CERT_REVIEW_MESSAGES.commentRequired,
    );
    expect(JSON.stringify((error as ValidationHttpException).getResponse())).toContain('comment');
    expect(db.dataSource.transaction).not.toHaveBeenCalled();
    expect(runRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 for a run that does not exist', async () => {
    runRepository.findOne.mockResolvedValue(null);
    await expect(service.decide({ runId: 7, decision: 'APPROVED', userId: 5 })).rejects.toThrow(
      NotFoundException,
    );
    expect(db.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('returns 409 and saves no comment when the run is no longer IN_REVIEW', async () => {
    db.runUpdate.mockResolvedValue({ affected: 0 });
    await expect(
      service.decide({ runId: 7, decision: 'REJECTED', comment: 'No', userId: 5 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.commentSave).not.toHaveBeenCalled();
    expect(db.snapshotUpdate).not.toHaveBeenCalled();
  });

  it('rolls the status back when the comment cannot be saved', async () => {
    db.commentSave.mockRejectedValue(new Error('insert failed'));
    await expect(service.decide({ runId: 7, decision: 'APPROVED', userId: 5 })).rejects.toThrow(
      'insert failed',
    );
    expect(db.state.status).toBe('IN_REVIEW');
    expect(db.snapshotUpdate).not.toHaveBeenCalled();
  });
});

describe('CertificationReviewService.getReview', () => {
  let runRepository: { findOne: jest.Mock };
  let domainRepository: { find: jest.Mock };
  let scenarioRepository: { find: jest.Mock };
  let stepRepository: { find: jest.Mock };
  let runScenarioRepository: { find: jest.Mock };
  let stepRunRepository: { find: jest.Mock };
  let stepErrorRepository: { find: jest.Mock };
  let tx: ReturnType<typeof makeReadTransaction>;
  let service: CertificationReviewService;

  const makeRun = (overrides: object = {}) => ({
    certificationRunId: 7,
    status: 'READY_FOR_REVIEW',
    certificationModel: 'SIS',
    catalogVersionId: 3,
    catalogVersion: { catalogVersionId: 3, dataStandardVersion: 'v5' },
    submittedAt: new Date('2026-11-01T10:00:00.000Z'),
    team: { name: 'Vendor team' },
    ods: { odsInstanceName: null, dbName: 'EdFi_Ods_255901' },
    edfiTenant: { displayName: 'Tenant A', sbEnvironment: { displayName: 'Env One' } },
    ...overrides,
  });

  beforeEach(() => {
    runRepository = { findOne: jest.fn().mockResolvedValue(makeRun()) };
    // Returned in the order the service asks for (display order), as the database would.
    domainRepository = {
      find: jest.fn().mockResolvedValue([
        { domainId: 2, name: 'Enrollment', displayName: null, displayOrder: 1, isEnabled: true },
        { domainId: 1, name: 'Student', displayName: ' ', displayOrder: 2, isEnabled: true },
      ]),
    };
    scenarioRepository = {
      find: jest.fn().mockResolvedValue([
        { scenarioId: 10, domainId: 1, name: 'Students', displayName: null, isEnabled: true },
        { scenarioId: 20, domainId: 2, name: 'Schools', displayName: 'Schools!', isEnabled: true },
        { scenarioId: 30, domainId: 2, name: 'Old', displayName: null, isEnabled: false },
      ]),
    };
    stepRepository = {
      find: jest.fn().mockResolvedValue([
        { stepId: 101, scenarioId: 10, stepName: 'S1', displayName: null, isEnabled: true },
        { stepId: 102, scenarioId: 10, stepName: 'S2', displayName: 'Two', isEnabled: false },
        { stepId: 103, scenarioId: 10, stepName: 'S3', displayName: null, isEnabled: false },
        { stepId: 201, scenarioId: 20, stepName: 'C1', displayName: null, isEnabled: true },
        { stepId: 301, scenarioId: 30, stepName: 'O1', displayName: null, isEnabled: true },
      ]),
    };
    runScenarioRepository = {
      find: jest.fn().mockResolvedValue([{ scenarioId: 10, status: 'completed' }]),
    };
    stepRunRepository = {
      find: jest.fn().mockResolvedValue([
        {
          stepRunId: 55,
          stepId: 101,
          status: 'success',
          runAt: new Date('2026-10-15T15:00:00.000Z'),
          inputs: null,
          responseStatus: 200,
        },
        {
          stepRunId: 56,
          stepId: 102,
          status: 'failed',
          runAt: new Date('2026-10-15T15:05:00.000Z'),
          inputs: { id: 'X' },
          responseStatus: 404,
        },
      ]),
    };
    stepErrorRepository = {
      find: jest.fn().mockResolvedValue([
        {
          stepRunId: 56,
          kind: 'assertion',
          field: 'name',
          expected: 'a',
          observed: 'b',
          message: 'Mismatch',
        },
      ]),
    };
    tx = makeReadTransaction();
    service = makeService({
      runRepository,
      domainRepository,
      scenarioRepository,
      stepRepository,
      runScenarioRepository,
      stepRunRepository,
      stepErrorRepository,
      dataSource: tx.dataSource,
    });
  });

  it('locks the run first and reads everything in that one transaction', async () => {
    await service.getReview(7);
    expect(tx.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(runRepository.findOne).toHaveBeenNthCalledWith(1, LOCKED_RUN_READ);
    for (const repository of [
      runRepository,
      domainRepository,
      scenarioRepository,
      stepRepository,
      runScenarioRepository,
      stepRunRepository,
      stepErrorRepository,
    ]) {
      expect(tx.em.withRepository).toHaveBeenCalledWith(repository);
    }
  });

  it.each(['DRAFT', 'CHANGES_REQUESTED'])('returns 404 for a %s run', async (status) => {
    runRepository.findOne.mockResolvedValue(makeRun({ status }));
    await expect(service.getReview(7)).rejects.toThrow(NotFoundException);
    expect(stepRunRepository.find).not.toHaveBeenCalled();
  });

  it('returns 404 for a run that does not exist', async () => {
    runRepository.findOne.mockResolvedValue(null);
    await expect(service.getReview(7)).rejects.toThrow(NotFoundException);
  });

  it('returns the run of a READY_FOR_REVIEW run', async () => {
    const review = await service.getReview(7);
    expect(runRepository.findOne).toHaveBeenCalledWith({
      where: { certificationRunId: 7 },
      relations: {
        team: true,
        ods: true,
        edfiTenant: { sbEnvironment: true },
        catalogVersion: true,
      },
    });
    expect(review.run).toEqual({
      runId: 7,
      teamName: 'Vendor team',
      environmentName: 'Env One',
      tenantName: 'Tenant A',
      dataStoreName: 'EdFi_Ods_255901',
      certificationModel: 'SIS',
      status: 'READY_FOR_REVIEW',
      submittedAt: '2026-11-01T10:00:00.000Z',
      dataStandardVersion: 'v5',
      canDecide: false,
    });
  });

  it('prefers the ODS instance name and allows a missing submittedAt', async () => {
    runRepository.findOne.mockResolvedValue(
      makeRun({ ods: { odsInstanceName: 'District', dbName: 'db' }, submittedAt: null }),
    );
    const { run } = await service.getReview(7);
    expect(run.dataStoreName).toBe('District');
    expect(run.submittedAt).toBeNull();
  });

  it.each([
    ['APPROVED', false],
    ['REJECTED', false],
    ['READY_FOR_REVIEW_WITH_CHANGES', false],
    ['IN_REVIEW', true],
  ])('reads a %s run with canDecide %p', async (status, canDecide) => {
    runRepository.findOne.mockResolvedValue(makeRun({ status }));
    const { run } = await service.getReview(7);
    expect(run.status).toBe(status);
    expect(run.canDecide).toBe(canDecide);
  });

  it('returns a null team name for a run without a team', async () => {
    runRepository.findOne.mockResolvedValue(makeRun({ team: null }));
    const { run } = await service.getReview(7);
    expect(run.teamName).toBeNull();
  });

  it('returns no scenarios for a run without a catalog version', async () => {
    runRepository.findOne.mockResolvedValue(
      makeRun({ catalogVersionId: null, catalogVersion: null, ods: null }),
    );
    const review = await service.getReview(7);
    expect(review.scenarios).toEqual([]);
    expect(review.run.dataStandardVersion).toBeNull();
    expect(review.run.dataStoreName).toBeNull();
    expect(scenarioRepository.find).not.toHaveBeenCalled();
  });

  it("reads the catalog without the enabled filter and the run's rows by run", async () => {
    await service.getReview(7);
    expect(domainRepository.find).toHaveBeenCalledWith({
      where: { catalogVersionId: 3 },
      order: { displayOrder: 'ASC', domainId: 'ASC' },
    });
    expect(scenarioRepository.find).toHaveBeenCalledWith({
      where: { domain: { catalogVersionId: 3 } },
      order: { displayOrder: 'ASC', scenarioId: 'ASC' },
    });
    expect(stepRepository.find).toHaveBeenCalledWith({
      where: { scenario: { domain: { catalogVersionId: 3 } } },
      order: { displayOrder: 'ASC', stepId: 'ASC' },
    });
    expect(runScenarioRepository.find).toHaveBeenCalledWith({ where: { certificationRunId: 7 } });
    expect(stepRunRepository.find).toHaveBeenCalledWith({ where: { certificationRunId: 7 } });
    expect(stepErrorRepository.find).toHaveBeenCalledWith({
      where: { stepRun: { certificationRunId: 7 } },
      order: { errorId: 'ASC' },
    });
  });

  it('orders by domain then scenario, keeps disabled steps with saved results only', async () => {
    const { scenarios } = await service.getReview(7);

    expect(scenarios.map((s) => s.scenarioId)).toEqual([20, 10]);
    expect(scenarios[0]).toEqual({
      scenarioId: 20,
      domainName: 'Enrollment',
      name: 'Schools!',
      status: null,
      steps: [{ stepId: 201, name: 'C1', result: null }],
    });
    expect(scenarios[1].domainName).toBe('Student');
    expect(scenarios[1].name).toBe('Students');
    expect(scenarios[1].status).toBe('completed');
    // 102 is disabled but has a saved result; 103 is disabled without one.
    expect(scenarios[1].steps.map((step) => step.stepId)).toEqual([101, 102]);
    expect(scenarios[1].steps[1].name).toBe('Two');
  });

  it('attaches the saved result and its errors to the right step', async () => {
    const { scenarios } = await service.getReview(7);
    const [first, second] = scenarios[1].steps;
    expect(first.result).toEqual({
      stepId: 101,
      status: 'success',
      ranAt: '2026-10-15T15:00:00.000Z',
      inputs: null,
      responseStatus: 200,
      errors: [],
    });
    expect(second.result).toEqual({
      stepId: 102,
      status: 'failed',
      ranAt: '2026-10-15T15:05:00.000Z',
      inputs: { id: 'X' },
      responseStatus: 404,
      errors: [
        { kind: 'assertion', field: 'name', expected: 'a', observed: 'b', message: 'Mismatch' },
      ],
    });
  });

  it('keeps a disabled scenario that has a saved row for this run', async () => {
    runScenarioRepository.find.mockResolvedValue([{ scenarioId: 30, status: 'failed' }]);
    const { scenarios } = await service.getReview(7);
    expect(scenarios.map((s) => s.scenarioId)).toEqual([20, 30, 10]);
    expect(scenarios[1].status).toBe('failed');
  });

  it('drops a scenario whose domain is disabled when it has no saved row', async () => {
    domainRepository.find.mockResolvedValue([
      { domainId: 2, name: 'Enrollment', displayName: null, displayOrder: 1, isEnabled: false },
      { domainId: 1, name: 'Student', displayName: null, displayOrder: 2, isEnabled: true },
    ]);
    const { scenarios } = await service.getReview(7);
    expect(scenarios.map((s) => s.scenarioId)).toEqual([10]);
  });
});

describe('CertificationReviewService.getSnapshot', () => {
  let runRepository: { findOne: jest.Mock };
  let stepRunsService: { findStepSnapshot: jest.Mock };
  let tx: ReturnType<typeof makeReadTransaction>;
  let service: CertificationReviewService;

  beforeEach(() => {
    runRepository = { findOne: jest.fn() };
    stepRunsService = { findStepSnapshot: jest.fn().mockResolvedValue({ state: 'none' }) };
    tx = makeReadTransaction();
    service = makeService({ runRepository, stepRunsService, dataSource: tx.dataSource });
  });

  it('returns 404 for a CHANGES_REQUESTED run without reading the snapshot', async () => {
    runRepository.findOne.mockResolvedValue({ certificationRunId: 7, status: 'CHANGES_REQUESTED' });
    await expect(service.getSnapshot(7, 101)).rejects.toThrow(NotFoundException);
    expect(stepRunsService.findStepSnapshot).not.toHaveBeenCalled();
  });

  it('returns 404 for a run that does not exist', async () => {
    runRepository.findOne.mockResolvedValue(null);
    await expect(service.getSnapshot(7, 101)).rejects.toThrow(NotFoundException);
  });

  it("reads an IN_REVIEW run's step snapshot in the transaction that locked the run", async () => {
    runRepository.findOne.mockResolvedValue({ certificationRunId: 7, status: 'IN_REVIEW' });
    await expect(service.getSnapshot(7, 101)).resolves.toEqual({ state: 'none' });
    expect(runRepository.findOne).toHaveBeenCalledWith(LOCKED_RUN_READ);
    expect(tx.em.withRepository).toHaveBeenCalledWith(runRepository);
    expect(stepRunsService.findStepSnapshot).toHaveBeenCalledWith(
      { certificationRunId: 7, stepId: 101 },
      tx.em,
    );
  });
});
