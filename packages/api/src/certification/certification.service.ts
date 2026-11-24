import {
  CERT_NOT_ALL_SCENARIOS_COMPLETED,
  CERT_RUN_STATUS,
  CERT_SCENARIO_STATUS,
  CERT_STEP_STATUS,
  CERT_RUN_CLOSED_STATUSES,
  CertificationStepRunDto,
  CertModel,
  CertRunStatus,
  CertScenarioStatus,
  canExecuteSteps,
  canTransitionRun,
  certRunAlreadyOpenMessage,
  certRunEventFor,
  isSupportedSisVersion,
  sendToReviewStatus,
} from '@edanalytics/models';
import {
  CertificationRun,
  CertificationRunEvent,
  CertificationRunScenario,
  EdfiTenant,
  SbEnvironment,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
} from '@edanalytics/models-server';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import fs from 'fs';
import { DataSource, EntityManager, FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { ArtifactService } from './artifact/artifact.service';
import { CertificationTarget, CertificationTargetService } from './certification-target.service';
import { RunLimiter } from './run-limiter';
import { buildBrunoArgs, runBrunoCli } from './runner/bruno-cli';
import {
  cleanMessage,
  incompleteRunReport,
  ParsedBrunoReport,
  parseBrunoReport,
  readBrunoReport,
} from './runner/bruno-report';
import { sanitizeCapturedVars } from './runner/captured-vars';
import { createRunWorkspace, readStepInputNames } from './runner/run-workspace';
import { validateStepInputs } from './runner/step-inputs';

export const CERT_RUN_MESSAGES = {
  runtimeNotReady:
    "Certification isn't available yet because its test scenarios are still loading. Try again in a minute.",
  unsupportedVersion: "This SIS version isn't supported yet. Supported: v5.",
  busyScenario: 'Another step of this scenario is running. Wait for it to finish, then try again.',
  atCapacity: 'Too many certification steps are running right now. Try again in a minute.',
  runLocked: "This certification run can't take new step results in its current status.",
  invalidTransition: "This certification run can't move to that status.",
  notAllScenariosCompleted: CERT_NOT_ALL_SCENARIOS_COMPLETED,
  unsupportedModel: "This Certification Model isn't available yet.",
  unsupportedDataStandard: (odsDsVersion: string | undefined) =>
    `Certification scenarios aren't available yet for Ed-Fi Data Standard ${odsDsVersion ?? '(unknown)'}.`,
  alreadyOpen: certRunAlreadyOpenMessage,
};

export interface RunStepParams {
  sbEnvironment: SbEnvironment;
  edfiTenant: EdfiTenant;
  /** The team's run, loaded with its catalog version. It fixes the data store and SIS version. */
  certificationRun: CertificationRun;
  stepId: number;
  token: string;
  inputs: Record<string, string>;
}

/** Matches the open run of one data store and Certification Model: at most one row (see the unique indexes). */
export const openRunWhere = (
  edfiTenantId: number,
  odsId: number | null,
  certificationModel: CertModel,
): FindOptionsWhere<CertificationRun> => ({
  edfiTenantId,
  odsId: odsId ?? IsNull(),
  certificationModel,
  status: Not(In([...CERT_RUN_CLOSED_STATUSES])),
});

/** A scenario passes when all its enabled steps pass; any failed step fails it. */
export const deriveScenarioStatus = (
  enabledStepIds: number[],
  runs: { stepId: number; status: string }[],
): CertScenarioStatus => {
  if (runs.some((run) => run.status === CERT_STEP_STATUS.failed))
    return CERT_SCENARIO_STATUS.failed;
  const passed = new Set(
    runs.filter((run) => run.status === CERT_STEP_STATUS.success).map((run) => run.stepId),
  );
  return enabledStepIds.every((stepId) => passed.has(stepId))
    ? CERT_SCENARIO_STATUS.completed
    : CERT_SCENARIO_STATUS.inprogress;
};

/** A catalog version is current when it's active, matches the requested SIS version, and matches the loaded artifact. */
export const isCurrentCatalogVersion = (
  catalogVersion: { isActive: boolean; dataStandardVersion: string; artifactVersion: string },
  sisVersion: string,
  currentRef: string | undefined,
): boolean =>
  catalogVersion.isActive &&
  catalogVersion.dataStandardVersion === sisVersion &&
  catalogVersion.artifactVersion === currentRef;

/** A finite number above zero, else the fallback, so a bad config value can't disable a cap or timeout. */
export const positiveNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isSslVerificationDisabled = () =>
  config.SSL_VERIFICATION === false || config.SSL_VERIFICATION === 'false';

/** Key names only, never values, so logs can't leak captured data. */
const describeKeys = (value: unknown): string =>
  value !== null && typeof value === 'object'
    ? Object.keys(value).slice(0, 50).join(', ') || 'none'
    : 'none';

/** [sisVersion, domain, scenario, fileName], straight from the catalog. */
const stepSegments = (step: StepCatalog): string[] => [
  step.scenario.domain.catalogVersion.dataStandardVersion,
  step.scenario.domain.name,
  step.scenario.name,
  step.fileName,
];

/** Columns every run status change must write; statusChangedAt drives the dashboard's waiting time. */
const statusChange = (status: CertRunStatus, now = new Date()) => {
  return { status, updatedAt: now, statusChangedAt: now };
};

/** Who made a status change and what it is recorded against in the run's history. */
export type TransitionRunOptions = {
  /** The signed-in user who made the change; null when the system did. */
  actorId: number | null;
  /** The run's catalog version, kept on the history entry. */
  catalogVersionId: number | null;
  /** The reviewer's comment the change carries, if any. */
  commentId?: number;
  /** Columns written with the status. */
  extra?: Partial<Pick<CertificationRun, 'submittedAt' | 'statusChangedAt'>>;
};

/**
 * Moves a run from one status to another, refusing any change CERT_RUN_TRANSITIONS doesn't
 * allow, and records the change in the run's history. The update only matches while the run is
 * still in `from`, so of two concurrent changes the second finds no row, writes no history and
 * gets a 409. Call it with the transaction's manager: the history entry must commit or roll back
 * together with the change. `extra` columns are written with it; a `statusChangedAt` in `extra`
 * also sets `updatedAt` and the entry's `createdAt`, so all of them stay one instant.
 */
export const transitionRun = async (
  em: EntityManager,
  certificationRunId: number,
  from: CertRunStatus,
  to: CertRunStatus,
  options: TransitionRunOptions,
): Promise<void> => {
  if (!canTransitionRun(from, to)) {
    throw new ConflictException(CERT_RUN_MESSAGES.invalidTransition);
  }
  const { actorId, catalogVersionId, commentId, extra = {} } = options;
  const now = extra.statusChangedAt ?? new Date();
  const moved = await em
    .getRepository(CertificationRun)
    .update({ certificationRunId, status: from }, { ...statusChange(to, now), ...extra });
  if (moved.affected !== 1) throw new ConflictException(CERT_RUN_MESSAGES.invalidTransition);
  await em.getRepository(CertificationRunEvent).insert({
    certificationRunId,
    event: certRunEventFor(from, to),
    fromStatus: from,
    toStatus: to,
    catalogVersionId,
    userId: actorId,
    certificationRunCommentId: commentId ?? null,
    createdAt: now,
  });
};

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);
  private readonly runLimiter = new RunLimiter(
    positiveNumber(config.CERT_BRUNO_MAX_CONCURRENT_RUNS, 2),
  );

  constructor(
    private readonly artifactService: ArtifactService,
    private readonly targetService: CertificationTargetService,
    @InjectRepository(StepCatalog)
    private readonly stepRepository: Repository<StepCatalog>,
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>,
    @InjectRepository(CertificationRunScenario)
    private readonly runScenarioRepository: Repository<CertificationRunScenario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Runs one catalog step with the artifact's Bruno CLI against the tenant's ODS/API (AC-466)
   * and saves the result. The token is used only for this run and is never stored or logged.
   */
  async runStep(params: RunStepParams): Promise<CertificationStepRunDto> {
    if (!this.artifactService.isRunTimeReady || !fs.existsSync(this.artifactService.brunoCliPath)) {
      throw new ServiceUnavailableException(CERT_RUN_MESSAGES.runtimeNotReady);
    }
    const { certificationRun } = params;
    const sisVersion = certificationRun.catalogVersion?.dataStandardVersion;
    if (!sisVersion || !isSupportedSisVersion(sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }
    // A safeguard behind the pages' disabled Run buttons (a stale tab, or a direct API call).
    // A run that doesn't exist was already refused: Start Run creates runs, a step run never does.
    if (!canExecuteSteps(certificationRun.status)) {
      throw new ConflictException(CERT_RUN_MESSAGES.runLocked);
    }

    const step = await this.findRunnableStep(params.stepId, sisVersion);
    // The step file is what runs, so it decides which inputs are expected (not the synced catalog rows).
    const inputNames = await readStepInputNames(this.artifactService.sisRoot, stepSegments(step));
    const inputErrors = validateStepInputs(inputNames, params.inputs);
    if (inputErrors.length > 0) {
      throw new ValidationHttpException(...inputErrors);
    }

    const target = await this.targetService.resolve({
      sbEnvironment: params.sbEnvironment,
      edfiTenant: params.edfiTenant,
      odsId: certificationRun.odsId,
    });

    const slot = this.runLimiter.tryAcquire(
      `${certificationRun.certificationRunId}:${step.scenarioId}`,
    );
    if (slot === 'busy-key') throw new ConflictException(CERT_RUN_MESSAGES.busyScenario);
    if (slot === 'at-capacity') throw new ServiceUnavailableException(CERT_RUN_MESSAGES.atCapacity);
    try {
      const parsed = await this.execute(step, certificationRun, target, params);
      return await this.saveResult(step, certificationRun, params.inputs, parsed);
    } finally {
      slot.release();
    }
  }

  /** The catalog is the allowlist: only enabled steps of the active catalog for this version and artifact run. */
  private async findRunnableStep(stepId: number, sisVersion: string): Promise<StepCatalog> {
    const step = await this.stepRepository.findOne({
      where: { stepId },
      relations: { scenario: { domain: { catalogVersion: true } } },
    });
    if (!step) throw new NotFoundException();
    const { scenario } = step;
    const { domain } = scenario;
    const { catalogVersion } = domain;
    const runnable =
      step.isEnabled &&
      scenario.isEnabled &&
      domain.isEnabled &&
      isCurrentCatalogVersion(catalogVersion, sisVersion, this.artifactService.currentRef);
    if (!runnable) throw new NotFoundException();
    return step;
  }

  /**
   * Sends a Draft or Changes requested run to review (AC-659) and returns its new status. Every
   * enabled scenario of the run's catalog version must be completed, else 409.
   *
   * The status changes first and the scenarios are counted after, in the same transaction.
   * The update locks the run row, which saveResult also updates before saving a step result,
   * so a step finishing meanwhile either commits before the count (and is counted) or finds
   * the run locked and is refused.
   */
  async sendToReview(
    certificationRun: Pick<CertificationRun, 'certificationRunId' | 'status' | 'catalogVersionId'>,
    actorId: number | null,
  ): Promise<CertRunStatus> {
    const { certificationRunId, status: from, catalogVersionId } = certificationRun;
    const to = sendToReviewStatus(from);
    if (!to || catalogVersionId === null) {
      throw new ConflictException(CERT_RUN_MESSAGES.invalidTransition);
    }

    return this.dataSource.transaction(async (em) => {
      // submittedAt is the same instant as statusChangedAt; statusChangedAt moves again at pick-up.
      const submittedAt = new Date();
      await transitionRun(em, certificationRunId, from, to, {
        actorId,
        catalogVersionId,
        extra: { statusChangedAt: submittedAt, submittedAt },
      });

      const enabledScenario = { isEnabled: true, domain: { isEnabled: true, catalogVersionId } };
      const enabled = await em.getRepository(ScenarioCatalog).count({ where: enabledScenario });
      const completed = await em.getRepository(CertificationRunScenario).count({
        where: {
          certificationRunId,
          status: CERT_SCENARIO_STATUS.completed,
          scenario: enabledScenario,
        },
      });
      // Thrown inside the transaction, so the status change and its history entry roll back.
      if (enabled === 0 || completed !== enabled) {
        throw new ConflictException(CERT_RUN_MESSAGES.notAllScenariosCompleted);
      }
      return to;
    });
  }

  private async execute(
    step: StepCatalog,
    certificationRun: CertificationRun,
    target: CertificationTarget,
    { token, inputs }: RunStepParams,
  ): Promise<ParsedBrunoReport> {
    const scenarioRow = await this.runScenarioRepository.findOne({
      where: {
        certificationRunId: certificationRun.certificationRunId,
        scenarioId: step.scenarioId,
      },
    });
    const storedVars = scenarioRow?.capturedVars ?? null;
    const restoredVars = sanitizeCapturedVars(storedVars ?? {}) ?? {};
    if (storedVars && sanitizeCapturedVars(storedVars) === null) {
      this.logger.warn(
        `Certification step ${step.stepId}: stored captured values were invalid and were ignored (keys: ${describeKeys(
          storedVars,
        )})`,
      );
    }
    const timeoutMs = positiveNumber(config.CERT_BRUNO_RUN_TIMEOUT_MS, 45000);
    const startedAt = Date.now();
    const workspace = await createRunWorkspace({
      sisRoot: this.artifactService.sisRoot,
      stepSegments: stepSegments(step),
      inputs,
      resourceBaseUrl: target.resourceBaseUrl,
      oauthUrl: target.oauthUrl,
      tokenExpiresAt: Math.floor((startedAt + timeoutMs) / 1000) + 60,
      restoredVars,
    });

    try {
      const cli = await runBrunoCli({
        cliPath: this.artifactService.brunoCliPath,
        cwd: workspace.dir,
        args: buildBrunoArgs({
          stepPath: workspace.stepPath,
          insecure: isSslVerificationDisabled(),
        }),
        token,
        timeoutMs,
      });
      const parsed = cli.timedOut
        ? incompleteRunReport()
        : parseBrunoReport(await readBrunoReport(workspace.reportPath), {
            stepPath: workspace.stepPath,
            token,
          });
      this.logger.log(
        `Certification step ${step.stepId} finished: exit=${cli.exitCode} timedOut=${cli.timedOut} ` +
          `complete=${parsed.complete} passed=${parsed.passed} ms=${Date.now() - startedAt}`,
      );
      if (parsed.capturedVarsRejectedKeys) {
        this.logger.warn(
          `Certification step ${step.stepId}: captured values failed validation and were not stored ` +
            `(keys: ${parsed.capturedVarsRejectedKeys.join(', ') || 'none'})`,
        );
      }
      if (!parsed.complete && cli.stderrTail) {
        this.logger.warn(
          `Certification step ${step.stepId} stderr: ${cleanMessage(cli.stderrTail, token)}`,
        );
      }
      return parsed;
    } finally {
      await workspace
        .dispose()
        .catch(() =>
          this.logger.warn(`Certification step ${step.stepId}: temporary workspace cleanup failed`),
        );
    }
  }

  /** One transaction: replace the step's row and errors, then update the scenario. */
  private saveResult(
    step: StepCatalog,
    certificationRun: CertificationRun,
    inputs: Record<string, string>,
    parsed: ParsedBrunoReport,
  ): Promise<CertificationStepRunDto> {
    const { certificationRunId } = certificationRun;
    const { stepId, scenarioId } = step;
    const ranAt = new Date();
    const status = parsed.passed ? CERT_STEP_STATUS.success : CERT_STEP_STATUS.failed;

    return this.dataSource.transaction(async (em) => {
      // Lock the run before writing evidence, serializing this save with status decisions.
      const writable = await em.getRepository(CertificationRun).update(
        {
          certificationRunId,
          status: In([CERT_RUN_STATUS.DRAFT, CERT_RUN_STATUS.CHANGES_REQUESTED]),
        },
        { updatedAt: ranAt },
      );
      if (writable.affected !== 1) throw new ConflictException(CERT_RUN_MESSAGES.runLocked);

      const stepRuns = em.getRepository(ScenarioStep);
      const existing = await stepRuns.findOne({ where: { certificationRunId, stepId } });
      const stepRun = await stepRuns.save(
        Object.assign(existing ?? stepRuns.create({ certificationRunId, scenarioId, stepId }), {
          status,
          inputs,
          runAt: ranAt,
          // Always written, so a re-run that sent nothing never keeps a stale status or snapshot.
          responseStatus: parsed.responseStatus,
          responseSnapshot: parsed.responseSnapshot,
        }),
      );

      const errors = em.getRepository(ScenarioStepError);
      await errors.delete({ stepRunId: stepRun.stepRunId });
      if (parsed.errors.length > 0) {
        await errors.save(
          parsed.errors.map((error) => ({ stepRunId: stepRun.stepRunId, ...error })),
        );
      }

      const enabledStepIds = (
        await em.getRepository(StepCatalog).find({ where: { scenarioId, isEnabled: true } })
      ).map((catalogStep) => catalogStep.stepId);
      const runs = await stepRuns.find({ where: { certificationRunId, scenarioId } });
      const scenarioStatus = deriveScenarioStatus(enabledStepIds, runs);

      const scenarios = em.getRepository(CertificationRunScenario);
      const scenarioRow =
        (await scenarios.findOne({ where: { certificationRunId, scenarioId } })) ??
        scenarios.create({ certificationRunId, scenarioId, capturedVars: null });
      scenarioRow.status = scenarioStatus;
      if (parsed.complete && parsed.capturedVars) {
        scenarioRow.capturedVars = parsed.capturedVars;
      }
      await scenarios.save(scenarioRow);

      return {
        stepId,
        status,
        ranAt: ranAt.toISOString(),
        scenarioStatus,
        responseStatus: parsed.responseStatus,
        errors: parsed.errors,
      };
    });
  }
}
