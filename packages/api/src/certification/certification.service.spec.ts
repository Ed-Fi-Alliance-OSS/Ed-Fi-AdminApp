import 'reflect-metadata';
import fs from 'fs';
import * as path from 'path';
import {
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CertificationRun,
  CertificationRunScenario,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
} from '@edanalytics/models-server';
import { CERT_NOT_ALL_SCENARIOS_COMPLETED } from '@edanalytics/models';
import {
  CERT_RUN_MESSAGES,
  CertificationService,
  deriveScenarioStatus,
  positiveNumber,
  transitionRun,
} from './certification.service';
import { In } from 'typeorm';
import { runBrunoCli } from './runner/bruno-cli';
import { readBrunoReport, INCOMPLETE_RUN_MESSAGE } from './runner/bruno-report';
import { createRunWorkspace, readStepInputNames } from './runner/run-workspace';

jest.mock('./runner/bruno-cli', () => ({
  ...jest.requireActual('./runner/bruno-cli'),
  runBrunoCli: jest.fn(),
}));
jest.mock('./runner/run-workspace', () => ({
  ...jest.requireActual('./runner/run-workspace'),
  createRunWorkspace: jest.fn(),
  readStepInputNames: jest.fn(),
}));
jest.mock('./runner/bruno-report', () => ({
  ...jest.requireActual('./runner/bruno-report'),
  readBrunoReport: jest.fn(),
}));

const fixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, 'runner', '__fixtures__', `${name}.json`), 'utf8'),
  );

const TOKEN = 'secret-token-value';
const STEP_PATH = 'v5/Student/Students/01 - 1st Student is valid.bru';
const sbEnvironment = { id: 1 } as never;
const edfiTenant = { id: 10, name: 'tenant1' } as never;

const makeStep = () => ({
  stepId: 101,
  scenarioId: 20,
  fileName: '01 - 1st Student is valid.bru',
  isEnabled: true,
  scenario: {
    scenarioId: 20,
    name: 'Students',
    isEnabled: true,
    domain: {
      name: 'Student',
      isEnabled: true,
      catalogVersionId: 3,
      catalogVersion: {
        catalogVersionId: 3,
        isActive: true,
        dataStandardVersion: 'v5',
        artifactVersion: 'v2.1.0',
      },
    },
  },
});

/** The run the controller loaded for the team; runStep never looks one up or creates one. */
const makeRun = (overrides: object = {}) =>
  ({
    certificationRunId: 7,
    edfiTenantId: 10,
    odsId: 5,
    status: 'DRAFT',
    catalogVersion: { catalogVersionId: 3, dataStandardVersion: 'v5' },
    ...overrides,
  }) as never;

describe('CertificationService.runStep', () => {
  let stepRepository: { findOne: jest.Mock };
  let runRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let runScenarioRepository: { findOne: jest.Mock };
  let em: Record<string, Record<string, jest.Mock>>;
  let dataSource: { transaction: jest.Mock };
  let artifactService: {
    isRunTimeReady: boolean;
    currentRef: string;
    sisRoot: string;
    brunoCliPath: string;
  };
  let targetService: { resolve: jest.Mock };
  let service: CertificationService;
  let dispose: jest.Mock;
  let cliExists: boolean;

  const run = (overrides: Partial<Parameters<CertificationService['runStep']>[0]> = {}) =>
    service.runStep({
      sbEnvironment,
      edfiTenant,
      certificationRun: makeRun(),
      stepId: 101,
      token: TOKEN,
      inputs: { studentUniqueId: 'S1' },
      ...overrides,
    });

  beforeEach(() => {
    jest.resetAllMocks();
    // Only the fake CLI path is faked; every other path keeps its real answer.
    cliExists = true;
    const realExistsSync = fs.existsSync.bind(fs);
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((target) =>
        target === '/sis/bru.js' ? cliExists : realExistsSync(target),
      );
    stepRepository = { findOne: jest.fn().mockResolvedValue(makeStep()) };
    runRepository = {
      findOne: jest.fn().mockResolvedValue({ certificationRunId: 7, status: 'DRAFT' }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ certificationRunId: 7, ...value })),
    };
    runScenarioRepository = {
      findOne: jest.fn().mockResolvedValue({ capturedVars: { firstStudentUniqueId: 'old' } }),
    };
    // Keyed by entity class name, matching em.getRepository(Entity) in the service.
    em = {
      [ScenarioStep.name]: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ stepRunId: 55, ...value })),
        find: jest.fn().mockResolvedValue([{ stepId: 101, status: 'success' }]),
      },
      [ScenarioStepError.name]: { delete: jest.fn(), save: jest.fn() },
      [CertificationRunScenario.name]: {
        findOne: jest.fn().mockResolvedValue({
          certificationRunId: 7,
          scenarioId: 20,
          capturedVars: { firstStudentUniqueId: 'old' },
        }),
        create: jest.fn((value) => value),
        save: jest.fn(),
      },
      [CertificationRun.name]: { update: jest.fn().mockResolvedValue({ affected: 1 }) },
      [StepCatalog.name]: { find: jest.fn().mockResolvedValue([{ stepId: 101 }]) },
    };
    dataSource = {
      transaction: jest.fn(async (work) =>
        work({ getRepository: (entity: { name: string }) => em[entity.name] }),
      ),
    };
    artifactService = {
      isRunTimeReady: true,
      currentRef: 'v2.1.0',
      sisRoot: '/sis',
      brunoCliPath: '/sis/bru.js',
    };
    targetService = {
      resolve: jest.fn().mockResolvedValue({
        oauthUrl: 'https://h/tenant1/oauth/token',
        resourceBaseUrl: 'https://h/tenant1/data/v3',
      }),
    };
    dispose = jest.fn().mockResolvedValue(undefined);
    (createRunWorkspace as jest.Mock).mockResolvedValue({
      dir: '/tmp/cert-run-x',
      stepPath: STEP_PATH,
      reportPath: '/tmp/cert-run-x/report.json',
      dispose,
    });
    (readStepInputNames as jest.Mock).mockResolvedValue(['studentUniqueId']);
    (runBrunoCli as jest.Mock).mockResolvedValue({ exitCode: 0, timedOut: false, stderrTail: '' });
    (readBrunoReport as jest.Mock).mockResolvedValue(fixture('step-passed'));

    service = new CertificationService(
      artifactService as never,
      targetService as never,
      stepRepository as never,
      runRepository as never,
      runScenarioRepository as never,
      dataSource as never,
    );
  });

  it('runs the step and saves a passing result with the captured values', async () => {
    const result = await run();

    expect(result).toEqual({
      stepId: 101,
      status: 'success',
      ranAt: expect.any(String),
      scenarioStatus: 'completed',
      responseStatus: 200,
      errors: [],
    });
    expect(createRunWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        sisRoot: '/sis',
        stepSegments: ['v5', 'Student', 'Students', '01 - 1st Student is valid.bru'],
        inputs: { studentUniqueId: 'S1' },
        resourceBaseUrl: 'https://h/tenant1/data/v3',
        oauthUrl: 'https://h/tenant1/oauth/token',
        restoredVars: { firstStudentUniqueId: 'old' },
      }),
    );
    expect(runBrunoCli).toHaveBeenCalledWith(
      expect.objectContaining({
        cliPath: '/sis/bru.js',
        cwd: '/tmp/cert-run-x',
        token: TOKEN,
        timeoutMs: 45000,
      }),
    );
    // config.mock sets SSL_VERIFICATION=false, so Bruno mirrors it with --insecure.
    expect((runBrunoCli as jest.Mock).mock.calls[0][0].args).toContain('--insecure');
    expect(em.CertificationRun.update).toHaveBeenCalledWith(
      { certificationRunId: 7, status: In(['DRAFT', 'CHANGES_REQUESTED']) },
      { updatedAt: expect.any(Date) },
    );
    expect(em.CertificationRun.update.mock.invocationCallOrder[0]).toBeLessThan(
      em.ScenarioStep.findOne.mock.invocationCallOrder[0],
    );
    expect(em.ScenarioStep.save).toHaveBeenCalledWith(
      expect.objectContaining({
        certificationRunId: 7,
        stepId: 101,
        status: 'success',
        inputs: { studentUniqueId: 'S1' },
        responseStatus: 200,
        responseSnapshot: expect.objectContaining({ state: 'body' }),
      }),
    );
    expect(em.ScenarioStepError.delete).toHaveBeenCalledWith({ stepRunId: 55 });
    expect(em.ScenarioStepError.save).not.toHaveBeenCalled();
    expect(em.CertificationRunScenario.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        capturedVars: {
          firstStudentUniqueId: 'abc123',
          firstStudentId: 'S1',
          firstStudentBirthDate: '2010-01-01',
          firstStudentBirthCity: 'Austin',
        },
      }),
    );
    expect(dispose).toHaveBeenCalled();
  });

  it.each([
    'READY_FOR_REVIEW',
    'IN_REVIEW',
    'READY_FOR_REVIEW_WITH_CHANGES',
    'APPROVED',
    'REJECTED',
  ])(
    'does not save evidence if the run changes to %s while Bruno is executing',
    async (nextStatus) => {
      let currentStatus = 'DRAFT';
      (runBrunoCli as jest.Mock).mockImplementation(async () => {
        currentStatus = nextStatus;
        return { exitCode: 0, timedOut: false, stderrTail: '' };
      });
      em.CertificationRun.update.mockImplementation(async () => ({
        affected: ['DRAFT', 'CHANGES_REQUESTED'].includes(currentStatus) ? 1 : 0,
      }));

      await expect(run()).rejects.toMatchObject({
        status: 409,
        message: CERT_RUN_MESSAGES.runLocked,
      });

      expect(runBrunoCli).toHaveBeenCalledTimes(1);
      expect(em.CertificationRun.update).toHaveBeenCalledWith(
        { certificationRunId: 7, status: In(['DRAFT', 'CHANGES_REQUESTED']) },
        { updatedAt: expect.any(Date) },
      );
      expect(em.ScenarioStep.findOne).not.toHaveBeenCalled();
      expect(em.ScenarioStep.save).not.toHaveBeenCalled();
      expect(em.ScenarioStepError.delete).not.toHaveBeenCalled();
      expect(em.CertificationRunScenario.save).not.toHaveBeenCalled();
      expect(dispose).toHaveBeenCalled();
    },
  );

  it('saves a failing result with its errors, replacing the previous row', async () => {
    em.ScenarioStep.findOne.mockResolvedValue({
      stepRunId: 55,
      certificationRunId: 7,
      scenarioId: 20,
      stepId: 101,
    });
    em.ScenarioStep.find.mockResolvedValue([{ stepId: 101, status: 'failed' }]);
    (readBrunoReport as jest.Mock).mockResolvedValue(fixture('partial-record'));

    const result = await run();

    expect(result.status).toBe('failed');
    expect(result.scenarioStatus).toBe('failed');
    expect(em.ScenarioStep.create).not.toHaveBeenCalled();
    expect(em.ScenarioStep.save).toHaveBeenCalledWith(
      expect.objectContaining({ stepRunId: 55, status: 'failed' }),
    );
    expect(em.ScenarioStepError.save).toHaveBeenCalledWith([
      {
        stepRunId: 55,
        kind: 'assertion',
        field: 'birthCity',
        expected: 'Not empty',
        observed: 'Empty text',
        message: "expected '' not to be empty",
      },
      expect.objectContaining({ kind: 'assertion', field: 'middleName', observed: 'Missing' }),
    ]);
    expect(result.errors).toHaveLength(2);
    expect(result.responseStatus).toBe(200);
  });

  it('clears the status and snapshot when a re-run never sent the request', async () => {
    em.ScenarioStep.findOne.mockResolvedValue({
      stepRunId: 55,
      certificationRunId: 7,
      scenarioId: 20,
      stepId: 101,
      responseStatus: 200,
      responseSnapshot: { state: 'body', body: '[]' },
    });
    em.ScenarioStep.find.mockResolvedValue([{ stepId: 101, status: 'failed' }]);
    (readBrunoReport as jest.Mock).mockResolvedValue(fixture('unreachable'));

    const result = await run();

    expect(result.responseStatus).toBeNull();
    expect(em.ScenarioStep.save).toHaveBeenCalledWith(
      expect.objectContaining({ stepRunId: 55, responseStatus: null, responseSnapshot: null }),
    );
  });

  it('keeps the stored captured values when the run does not complete', async () => {
    (runBrunoCli as jest.Mock).mockResolvedValue({
      exitCode: null,
      timedOut: true,
      stderrTail: '',
    });
    em.ScenarioStep.find.mockResolvedValue([{ stepId: 101, status: 'failed' }]);

    const result = await run();

    expect(result.status).toBe('failed');
    expect(result.errors).toEqual([
      {
        kind: 'exception',
        field: null,
        expected: null,
        observed: null,
        message: INCOMPLETE_RUN_MESSAGE,
      },
    ]);
    expect(em.CertificationRunScenario.save).toHaveBeenCalledWith(
      expect.objectContaining({ capturedVars: { firstStudentUniqueId: 'old' } }),
    );
  });

  it('still saves the result when removing the workspace fails, and warns', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    dispose.mockRejectedValue(new Error(`EBUSY: ${TOKEN}`));

    const result = await run();

    expect(result.status).toBe('success');
    expect(em.ScenarioStep.save).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/step 101.*workspace cleanup failed/));
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
  });

  it('drops tampered stored captured values, restores none, and logs only the keys', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    runScenarioRepository.findOne.mockResolvedValue({
      capturedVars: { tamperedKey: { nested: 'hidden-value-123' }, okKey: 'fine' },
    });

    await run();

    expect(createRunWorkspace).toHaveBeenCalledWith(expect.objectContaining({ restoredVars: {} }));
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('tamperedKey');
    expect(logged).toContain('101');
    expect(logged).not.toContain('hidden-value-123');
    expect(logged).not.toContain('fine');
  });

  it('does not warn when there are no stored captured values', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    runScenarioRepository.findOne.mockResolvedValue(null);
    await run();
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs the keys, not the values, of a captured body that fails validation, and keeps stored values', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const report = fixture('step-passed');
    report[0].results[2].request.data = JSON.stringify({ badKey: { inner: 'leaky-value-456' } });
    (readBrunoReport as jest.Mock).mockResolvedValue(report);

    await run();

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('badKey');
    expect(logged).toContain('101');
    expect(logged).not.toContain('leaky-value-456');
    expect(em.CertificationRunScenario.save).toHaveBeenCalledWith(
      expect.objectContaining({ capturedVars: { firstStudentUniqueId: 'old' } }),
    );
  });

  it('removes the workspace even when the CLI throws', async () => {
    (runBrunoCli as jest.Mock).mockRejectedValue(new Error('spawn failed'));
    await expect(run()).rejects.toThrow('spawn failed');
    expect(dispose).toHaveBeenCalled();
  });

  it('saves the result under the given run, and neither looks up nor creates a run', async () => {
    await run();
    expect(runRepository.findOne).not.toHaveBeenCalled();
    expect(runRepository.create).not.toHaveBeenCalled();
    expect(runRepository.save).not.toHaveBeenCalled();
    expect(em.ScenarioStep.save).toHaveBeenCalledWith(
      expect.objectContaining({ certificationRunId: 7 }),
    );
  });

  it("sends the step to the run's data store", async () => {
    await run({ certificationRun: makeRun({ odsId: 8 }) });
    expect(targetService.resolve).toHaveBeenCalledWith({ sbEnvironment, edfiTenant, odsId: 8 });
  });

  it.each([
    'READY_FOR_REVIEW',
    'IN_REVIEW',
    'READY_FOR_REVIEW_WITH_CHANGES',
    'APPROVED',
    'REJECTED',
  ])('returns 409 and saves nothing while the run is %s', async (status) => {
    await expect(run({ certificationRun: makeRun({ status }) })).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.runLocked,
    });
    expect(targetService.resolve).not.toHaveBeenCalled();
    expect(runBrunoCli).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('runs steps while the run is Changes requested', async () => {
    await expect(
      run({ certificationRun: makeRun({ status: 'CHANGES_REQUESTED' }) }),
    ).resolves.toMatchObject({ status: 'success' });
  });

  it('returns 503 while the runtime is not ready', async () => {
    artifactService.isRunTimeReady = false;
    await expect(run()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 503 when the Bruno CLI file is missing, without running anything', async () => {
    cliExists = false;
    await expect(run()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(runBrunoCli).not.toHaveBeenCalled();
    expect(createRunWorkspace).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsupported SIS version', { catalogVersionId: 2, dataStandardVersion: 'v4' }],
    ['no catalog', null],
  ])('rejects a run with %s before touching the catalog', async (_name, catalogVersion) => {
    await expect(run({ certificationRun: makeRun({ catalogVersion }) })).rejects.toMatchObject({
      status: 400,
    });
    expect(stepRepository.findOne).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', () => null],
    ['disabled', () => ({ ...makeStep(), isEnabled: false })],
    [
      'from another SIS version',
      () => {
        const s = makeStep();
        s.scenario.domain.catalogVersion.dataStandardVersion = 'v4';
        return s;
      },
    ],
    [
      'from an inactive catalog',
      () => {
        const s = makeStep();
        s.scenario.domain.catalogVersion.isActive = false;
        return s;
      },
    ],
    [
      'from another artifact',
      () => {
        const s = makeStep();
        s.scenario.domain.catalogVersion.artifactVersion = 'v9';
        return s;
      },
    ],
  ])('returns 404 for a step that is %s', async (_label, step) => {
    stepRepository.findOne.mockResolvedValue(step());
    await expect(run()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid inputs without running Bruno', async () => {
    await expect(run({ inputs: { notAnInput: 'x' } })).rejects.toMatchObject({ status: 400 });
    expect(runBrunoCli).not.toHaveBeenCalled();
  });

  it('takes the expected inputs from the step file, so disabled ~ params are not required', async () => {
    // The file has `~schoolId: [ENTER ...]` disabled, so only studentUniqueId is an input.
    await run({ inputs: { studentUniqueId: 'S1' } });
    expect(readStepInputNames).toHaveBeenCalledWith('/sis', [
      'v5',
      'Student',
      'Students',
      '01 - 1st Student is valid.bru',
    ]);
    await expect(run({ inputs: { studentUniqueId: 'S1', schoolId: '1' } })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('returns 409 while another step of the same scenario is running', async () => {
    let finish: (value: unknown) => void = () => undefined;
    (runBrunoCli as jest.Mock).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const first = run();
    await new Promise((resolve) => setImmediate(resolve));

    await expect(run()).rejects.toBeInstanceOf(ConflictException);

    finish({ exitCode: 0, timedOut: false, stderrTail: '' });
    await first;
  });

  it('returns 503 at the concurrency cap', async () => {
    const limiter = (service as unknown as { runLimiter: { tryAcquire: jest.Mock } }).runLimiter;
    jest.spyOn(limiter, 'tryAcquire').mockReturnValue('at-capacity');
    await expect(run()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never logs the token', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    (runBrunoCli as jest.Mock).mockResolvedValue({
      exitCode: 1,
      timedOut: false,
      stderrTail: `boom ${TOKEN}`,
    });
    (readBrunoReport as jest.Mock).mockResolvedValue(null);

    await run();

    const logged = JSON.stringify([...log.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain(TOKEN);
  });

  it('keeps the token out of everything saved, returned or logged, wherever a report echoes it', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const echoed = `Bearer ${TOKEN}`;
    const report = fixture('partial-record');
    const step = report[0].results[1];
    step.response.data = [{ echo: echoed }];
    step.assertionResults = [
      {
        lhsExpr: echoed,
        rhsExpr: `eq ${echoed}`,
        operator: 'eq',
        rhsOperand: echoed,
        status: 'fail',
        error: echoed,
      },
    ];
    step.postResponseTestResults = [{ description: echoed, status: 'fail', error: echoed }];
    report[0].results[2].request.data = JSON.stringify({ echoedKey: echoed });
    (readBrunoReport as jest.Mock).mockResolvedValue(report);
    (runBrunoCli as jest.Mock).mockResolvedValue({
      exitCode: 1,
      timedOut: false,
      stderrTail: `boom ${TOKEN}`,
    });

    const result = await run();

    const sinks = Object.values(em).flatMap((repository) =>
      ['save', 'update', 'delete'].flatMap((method) => repository[method]?.mock.calls ?? []),
    );
    const saved = JSON.stringify([
      sinks,
      runRepository.save.mock.calls,
      result,
      log.mock.calls,
      warn.mock.calls,
    ]);
    expect(sinks.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(2);
    expect(em.ScenarioStep.save).toHaveBeenCalledWith(
      expect.objectContaining({ responseSnapshot: expect.objectContaining({ state: 'body' }) }),
    );
    expect(saved).not.toContain(TOKEN);
    expect(JSON.stringify(warn.mock.calls)).toContain('echoedKey');
    expect(em.CertificationRunScenario.save).toHaveBeenCalledWith(
      expect.objectContaining({ capturedVars: { firstStudentUniqueId: 'old' } }),
    );
  });
});

describe('positiveNumber', () => {
  it.each([
    ['abc', 5],
    ['0', 5],
    ['-5', 5],
    [undefined, 5],
    [null, 5],
    ['', 5],
    [Infinity, 5],
    ['30000', 30000],
    [2, 2],
  ])('turns %j into %j', (value, expected) => {
    expect(positiveNumber(value, 5)).toBe(expected);
  });
});

describe('deriveScenarioStatus', () => {
  it('is failed when any step failed', () => {
    expect(
      deriveScenarioStatus(
        [1, 2],
        [
          { stepId: 1, status: 'success' },
          { stepId: 2, status: 'failed' },
        ],
      ),
    ).toBe('failed');
  });

  it('is completed when every enabled step passed', () => {
    expect(
      deriveScenarioStatus(
        [1, 2],
        [
          { stepId: 1, status: 'success' },
          { stepId: 2, status: 'success' },
        ],
      ),
    ).toBe('completed');
  });

  it('is in progress while some steps have not run', () => {
    expect(deriveScenarioStatus([1, 2], [{ stepId: 1, status: 'success' }])).toBe('inprogress');
  });
});

describe('transitionRun', () => {
  let update: jest.Mock;
  let em: { getRepository: jest.Mock };

  beforeEach(() => {
    update = jest.fn().mockResolvedValue({ affected: 1 });
    em = { getRepository: jest.fn(() => ({ update })) };
  });

  it('updates the run guarded by its current status and resolves when one row changed', async () => {
    await expect(
      transitionRun(em as never, 7, 'IN_REVIEW', 'APPROVED', { submittedAt: null }),
    ).resolves.toBeUndefined();
    expect(em.getRepository).toHaveBeenCalledWith(CertificationRun);
    expect(update).toHaveBeenCalledWith(
      { certificationRunId: 7, status: 'IN_REVIEW' },
      {
        status: 'APPROVED',
        updatedAt: expect.any(Date),
        statusChangedAt: expect.any(Date),
        submittedAt: null,
      },
    );
    const [, changes] = update.mock.calls[0];
    expect(changes.statusChangedAt).toBe(changes.updatedAt);
  });

  it('returns a conflict when the status changed after it was read', async () => {
    update.mockResolvedValue({ affected: 0 });
    await expect(transitionRun(em as never, 7, 'IN_REVIEW', 'APPROVED')).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.invalidTransition,
    });
  });

  it('refuses Draft straight to Approved without updating', async () => {
    await expect(transitionRun(em as never, 7, 'DRAFT', 'APPROVED')).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.invalidTransition,
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('CertificationService.sendToReview', () => {
  let runUpdate: jest.Mock;
  let scenarioCount: jest.Mock;
  let completedCount: jest.Mock;
  let dataSource: { transaction: jest.Mock };
  let service: CertificationService;

  const run = (status: string) =>
    ({ certificationRunId: 7, status, catalogVersionId: 11 }) as Parameters<
      CertificationService['sendToReview']
    >[0];

  let runRow: { status: string };

  beforeEach(() => {
    runRow = { status: 'DRAFT' };
    runUpdate = jest.fn(async (_where, set: { status: string }) => {
      runRow.status = set.status;
      return { affected: 1 };
    });
    scenarioCount = jest.fn().mockResolvedValue(3);
    completedCount = jest.fn().mockResolvedValue(3);
    const em: Record<string, Record<string, jest.Mock>> = {
      [CertificationRun.name]: { update: runUpdate },
      [ScenarioCatalog.name]: { count: scenarioCount },
      [CertificationRunScenario.name]: { count: completedCount },
    };
    dataSource = {
      // Like a real transaction: a callback that throws undoes the run's status update.
      transaction: jest.fn(async (work) => {
        const before = { ...runRow };
        try {
          return await work({ getRepository: (entity: { name: string }) => em[entity.name] });
        } catch (error) {
          runRow = before;
          throw error;
        }
      }),
    };
    service = new CertificationService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
    );
  });

  it.each([
    ['DRAFT', 'READY_FOR_REVIEW'],
    ['CHANGES_REQUESTED', 'READY_FOR_REVIEW_WITH_CHANGES'],
  ] as const)('moves a %s run to %s when every scenario is completed', async (from, to) => {
    await expect(service.sendToReview(run(from))).resolves.toBe(to);
    expect(runUpdate).toHaveBeenCalledWith(
      { certificationRunId: 7, status: from },
      {
        status: to,
        updatedAt: expect.any(Date),
        statusChangedAt: expect.any(Date),
        submittedAt: expect.any(Date),
      },
    );
    const payload = runUpdate.mock.calls[0][1];
    expect(payload.statusChangedAt).toBe(payload.updatedAt);
    expect(payload.submittedAt).toBe(payload.statusChangedAt);
  });

  it.each([
    'READY_FOR_REVIEW',
    'IN_REVIEW',
    'READY_FOR_REVIEW_WITH_CHANGES',
    'APPROVED',
    'REJECTED',
  ])('refuses a %s run without opening a transaction', async (from) => {
    await expect(service.sendToReview(run(from))).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.invalidTransition,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('refuses when the status changed after it was read', async () => {
    runUpdate.mockResolvedValue({ affected: 0 });
    await expect(service.sendToReview(run('DRAFT'))).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.invalidTransition,
    });
    expect(scenarioCount).not.toHaveBeenCalled();
  });

  it('puts the status back when a scenario is not completed', async () => {
    completedCount.mockResolvedValue(2);
    await expect(service.sendToReview(run('DRAFT'))).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.notAllScenariosCompleted,
    });
    expect(runUpdate).toHaveBeenCalled();
    expect(runRow.status).toBe('DRAFT');
  });

  it('shares the "every scenario" message with the Scenarios page', () => {
    expect(CERT_RUN_MESSAGES.notAllScenariosCompleted).toBe(CERT_NOT_ALL_SCENARIOS_COMPLETED);
  });

  it('refuses a run without a catalog version', async () => {
    await expect(
      service.sendToReview({ certificationRunId: 7, status: 'DRAFT', catalogVersionId: null }),
    ).rejects.toMatchObject({ status: 409, message: CERT_RUN_MESSAGES.invalidTransition });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('refuses a catalog version with no enabled scenarios', async () => {
    scenarioCount.mockResolvedValue(0);
    completedCount.mockResolvedValue(0);
    await expect(service.sendToReview(run('DRAFT'))).rejects.toMatchObject({
      status: 409,
      message: CERT_RUN_MESSAGES.notAllScenariosCompleted,
    });
  });

  it('updates the run before counting scenarios, so a step save cannot slip in between', async () => {
    await service.sendToReview(run('DRAFT'));
    expect(runUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      scenarioCount.mock.invocationCallOrder[0],
    );
    expect(runUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      completedCount.mock.invocationCallOrder[0],
    );
  });

  it("counts only enabled scenarios in enabled domains of the run's catalog version", async () => {
    await service.sendToReview(run('DRAFT'));
    const enabledScenario = { isEnabled: true, domain: { isEnabled: true, catalogVersionId: 11 } };
    expect(scenarioCount).toHaveBeenCalledWith({ where: enabledScenario });
    expect(completedCount).toHaveBeenCalledWith({
      where: { certificationRunId: 7, status: 'completed', scenario: enabledScenario },
    });
  });
});
