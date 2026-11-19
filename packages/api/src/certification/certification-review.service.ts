import {
  CERT_REVIEW_DECISION,
  CERT_REVIEW_MESSAGES,
  CERT_REVIEW_QUEUE_STATUSES,
  CERT_RUN_STATUS,
  CERT_SCENARIO_STATUS,
  CertificationReviewDto,
  CertificationReviewScenarioDto,
  CertificationReviewStatusDto,
  CertificationStepSnapshotDto,
  CertReviewDecision,
  CertRunStatus,
  CertScenarioStatus,
  isReviewReadable,
  reviewDecisionNeedsComment,
  toCertificationReviewDto,
  toCertificationReviewStatusDto,
} from '@edanalytics/models';
import {
  CertificationRun,
  CertificationRunComment,
  CertificationRunScenario,
  DomainCatalog,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
} from '@edanalytics/models-server';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { CertificationStepRunsService, toSavedStepRunDto } from './certification-step-runs.service';
import { CERT_RUN_MESSAGES, transitionRun } from './certification.service';

export interface DecideParams {
  runId: number;
  decision: CertReviewDecision;
  comment?: string;
  /** The signed-in reviewer, recorded as the comment's author. */
  userId: number | null;
}

/** The status each decision moves an In review run to. */
const DECISION_STATUS: Record<CertReviewDecision, CertRunStatus> = {
  [CERT_REVIEW_DECISION.APPROVED]: CERT_RUN_STATUS.APPROVED,
  [CERT_REVIEW_DECISION.REJECTED]: CERT_RUN_STATUS.REJECTED,
  [CERT_REVIEW_DECISION.CHANGES_REQUESTED]: CERT_RUN_STATUS.CHANGES_REQUESTED,
};

const SCENARIO_STATUSES: readonly unknown[] = Object.values(CERT_SCENARIO_STATUS);

/** A saved scenario status the review DTO knows; anything else is shown as no status. */
const isScenarioStatus = (value: unknown): value is CertScenarioStatus =>
  SCENARIO_STATUSES.includes(value);

/** The catalog's name for an item, as the vendor pages show it. */
const nameOf = (displayName: string | null, name: string) => displayName?.trim() || name;

/**
 * Global admins' side of certification (AC-660): pick a run up, read its results, and decide
 * it. Every status change is a guarded update, so when two reviewers act on the same run at
 * once only the first one wins and the other gets 409.
 */
@Injectable()
export class CertificationReviewService {
  constructor(
    private readonly stepRunsService: CertificationStepRunsService,
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>,
    @InjectRepository(DomainCatalog)
    private readonly domainRepository: Repository<DomainCatalog>,
    @InjectRepository(ScenarioCatalog)
    private readonly scenarioRepository: Repository<ScenarioCatalog>,
    @InjectRepository(StepCatalog)
    private readonly stepRepository: Repository<StepCatalog>,
    @InjectRepository(CertificationRunScenario)
    private readonly runScenarioRepository: Repository<CertificationRunScenario>,
    @InjectRepository(ScenarioStep)
    private readonly stepRunRepository: Repository<ScenarioStep>,
    @InjectRepository(ScenarioStepError)
    private readonly stepErrorRepository: Repository<ScenarioStepError>,
    private readonly dataSource: DataSource,
  ) {}

  /** Moves a run waiting for review to In review. */
  async pickUp(runId: number): Promise<CertificationReviewStatusDto> {
    const run = await this.findRunStatus(runId);
    if (!CERT_REVIEW_QUEUE_STATUSES.includes(run.status)) {
      throw new ConflictException(CERT_RUN_MESSAGES.invalidTransition);
    }
    await this.dataSource.transaction((em) =>
      transitionRun(em, runId, run.status, CERT_RUN_STATUS.IN_REVIEW),
    );
    return toCertificationReviewStatusDto({ runId, status: CERT_RUN_STATUS.IN_REVIEW });
  }

  /**
   * Approves, rejects or asks for changes on a run in review, and records the decision as a
   * comment. A final decision (approve or reject) also deletes the run's response snapshots.
   */
  async decide(params: DecideParams): Promise<CertificationReviewStatusDto> {
    const { runId, decision, userId } = params;
    const text = params.comment?.trim() || null;
    if (reviewDecisionNeedsComment(decision) && !text) {
      throw new ValidationHttpException({
        field: 'comment',
        message: CERT_REVIEW_MESSAGES.commentRequired,
      });
    }
    // Only for the 404; the guarded update below is what refuses a run that isn't In review.
    await this.findRunStatus(runId);

    const to = DECISION_STATUS[decision];
    await this.dataSource.transaction(async (em) => {
      await transitionRun(em, runId, CERT_RUN_STATUS.IN_REVIEW, to);
      const comments = em.getRepository(CertificationRunComment);
      await comments.save(
        comments.create({ certificationRunId: runId, authorId: userId, decision, text }),
      );
      if (
        decision === CERT_REVIEW_DECISION.APPROVED ||
        decision === CERT_REVIEW_DECISION.REJECTED
      ) {
        await em
          .getRepository(ScenarioStep)
          .update({ certificationRunId: runId }, { responseSnapshot: null });
      }
    });
    return toCertificationReviewStatusDto({ runId, status: to });
  }

  /** A readable run with its scenarios, steps and saved results. */
  async getReview(runId: number): Promise<CertificationReviewDto> {
    return this.dataSource.transaction(async (em) => {
      await this.lockReadableRun(em, runId);
      const run = await em.withRepository(this.runRepository).findOne({
        where: { certificationRunId: runId },
        relations: {
          team: true,
          ods: true,
          edfiTenant: { sbEnvironment: true },
          catalogVersion: true,
        },
      });
      if (!run || !isReviewReadable(run.status)) throw new NotFoundException();
      return this.toReview(em, runId, run);
    });
  }

  /** A step's response snapshot, while its run is readable. */
  async getSnapshot(runId: number, stepId: number): Promise<CertificationStepSnapshotDto> {
    return this.dataSource.transaction(async (em) => {
      await this.lockReadableRun(em, runId);
      return this.stepRunsService.findStepSnapshot({ certificationRunId: runId, stepId }, em);
    });
  }

  /**
   * Share-locks the run row until the read's transaction ends, else 404 when it isn't readable.
   * A decision and a vendor's step save both update this row first, so neither can change the
   * status or the evidence half-way through the read.
   */
  private async lockReadableRun(em: EntityManager, runId: number) {
    const run = await em.withRepository(this.runRepository).findOne({
      where: { certificationRunId: runId },
      select: { certificationRunId: true, status: true },
      lock: { mode: 'pessimistic_read' },
    });
    if (!run || !isReviewReadable(run.status)) throw new NotFoundException();
  }

  private async toReview(
    em: EntityManager,
    runId: number,
    run: CertificationRun,
  ): Promise<CertificationReviewDto> {
    return toCertificationReviewDto({
      run: {
        runId,
        teamName: run.team?.name ?? null,
        environmentName: run.edfiTenant.sbEnvironment.displayName,
        tenantName: run.edfiTenant.displayName,
        dataStoreName: run.ods?.odsInstanceName ?? run.ods?.dbName ?? null,
        certificationModel: run.certificationModel,
        status: run.status,
        submittedAt: run.submittedAt?.toISOString() ?? null,
        dataStandardVersion: run.catalogVersion?.dataStandardVersion ?? null,
        canDecide: run.status === CERT_RUN_STATUS.IN_REVIEW,
      },
      scenarios:
        run.catalogVersionId === null
          ? []
          : await this.findScenarios(em, runId, run.catalogVersionId),
    });
  }

  private async findRunStatus(runId: number) {
    const run = await this.runRepository.findOne({
      where: { certificationRunId: runId },
      select: { certificationRunId: true, status: true },
    });
    if (!run) throw new NotFoundException();
    return run;
  }

  /**
   * The catalog version's scenarios and steps, in display order. A disabled one is kept when
   * this run saved a result for it, so a reviewer still sees what the vendor ran.
   */
  private async findScenarios(
    em: EntityManager,
    certificationRunId: number,
    catalogVersionId: number,
  ): Promise<CertificationReviewScenarioDto[]> {
    const [domains, scenarios, steps, runScenarios, stepRuns, errors] = await Promise.all([
      em.withRepository(this.domainRepository).find({
        where: { catalogVersionId },
        order: { displayOrder: 'ASC', domainId: 'ASC' },
      }),
      em.withRepository(this.scenarioRepository).find({
        where: { domain: { catalogVersionId } },
        order: { displayOrder: 'ASC', scenarioId: 'ASC' },
      }),
      em.withRepository(this.stepRepository).find({
        where: { scenario: { domain: { catalogVersionId } } },
        order: { displayOrder: 'ASC', stepId: 'ASC' },
      }),
      em.withRepository(this.runScenarioRepository).find({ where: { certificationRunId } }),
      em.withRepository(this.stepRunRepository).find({ where: { certificationRunId } }),
      em.withRepository(this.stepErrorRepository).find({
        where: { stepRun: { certificationRunId } },
        order: { errorId: 'ASC' },
      }),
    ]);

    const scenarioStatus = new Map(runScenarios.map((row) => [row.scenarioId, row.status]));
    const stepRunByStep = new Map(stepRuns.map((stepRun) => [stepRun.stepId, stepRun]));

    return domains.flatMap((domain) =>
      scenarios
        .filter((scenario) => scenario.domainId === domain.domainId)
        .flatMap((scenario) => {
          const enabled = domain.isEnabled && scenario.isEnabled;
          const scenarioSteps = steps
            .filter((step) => step.scenarioId === scenario.scenarioId)
            .filter((step) => (enabled && step.isEnabled) || stepRunByStep.has(step.stepId))
            .map((step) => {
              const stepRun = stepRunByStep.get(step.stepId);
              return {
                stepId: step.stepId,
                name: nameOf(step.displayName, step.stepName),
                result: stepRun ? toSavedStepRunDto(stepRun, errors) : null,
              };
            });
          const savedStatus = scenarioStatus.get(scenario.scenarioId) ?? null;
          const kept = enabled || savedStatus !== null || scenarioSteps.some((step) => step.result);
          if (!kept) return [];
          return [
            {
              scenarioId: scenario.scenarioId,
              domainName: nameOf(domain.displayName, domain.name),
              name: nameOf(scenario.displayName, scenario.name),
              status: isScenarioStatus(savedStatus) ? savedStatus : null,
              steps: scenarioSteps,
            },
          ];
        }),
    );
  }
}
