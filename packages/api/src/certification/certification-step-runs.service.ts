import {
  CERT_SNAPSHOT_STATE,
  CertificationScenarioStatusDto,
  CertificationScenarioStatusesDto,
  CertificationStepRunsDto,
  CertificationStepSnapshotDto,
  CertStepErrorKind,
  canExecuteSteps,
  toCertificationScenarioStatusesDto,
  toCertificationStepRunsDto,
  toCertificationStepSnapshotDto,
} from '@edanalytics/models';
import {
  CertificationRun,
  CertificationRunScenario,
  ScenarioStep,
  ScenarioStepError,
} from '@edanalytics/models-server';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

export interface FindStepRunsParams {
  certificationRunId: number;
  scenarioId: number;
}

/**
 * Reads the saved step results that CertificationService.runStep writes (AC-475).
 * Read-only: it never creates a certification run and never contacts the ODS/API.
 * Every read is of one run, which the controller has already checked belongs to the team
 * (AC-651), so a finished run's results never show under the run that follows it.
 */
@Injectable()
export class CertificationStepRunsService {
  constructor(
    @InjectRepository(CertificationRunScenario)
    private readonly runScenarioRepository: Repository<CertificationRunScenario>,
    @InjectRepository(ScenarioStep)
    private readonly stepRunRepository: Repository<ScenarioStep>,
    @InjectRepository(ScenarioStepError)
    private readonly stepErrorRepository: Repository<ScenarioStepError>,
  ) {}

  async findStepRuns(params: FindStepRunsParams): Promise<CertificationStepRunsDto> {
    const { certificationRunId, scenarioId } = params;
    const [stepRuns, scenarioRow] = await Promise.all([
      this.stepRunRepository.find({ where: { certificationRunId, scenarioId } }),
      this.runScenarioRepository.findOne({ where: { certificationRunId, scenarioId } }),
    ]);
    const errors =
      stepRuns.length > 0
        ? await this.stepErrorRepository.find({
            where: { stepRunId: In(stepRuns.map((stepRun) => stepRun.stepRunId)) },
            order: { errorId: 'ASC' },
          })
        : [];

    return toCertificationStepRunsDto({
      scenarioStatus: (scenarioRow?.status ?? null) as CertificationStepRunsDto['scenarioStatus'],
      steps: stepRuns.map((stepRun) => ({
        stepId: stepRun.stepId,
        status: stepRun.status as CertificationStepRunsDto['steps'][number]['status'],
        ranAt: stepRun.runAt.toISOString(),
        inputs: stepRun.inputs,
        responseStatus: stepRun.responseStatus ?? null,
        errors: errors
          .filter((error) => error.stepRunId === stepRun.stepRunId)
          .map((error) => ({
            kind: error.kind as CertStepErrorKind,
            field: error.field,
            expected: error.expected,
            observed: error.observed,
            message: error.message,
          })),
      })),
    });
  }

  /**
   * The run and its scenario statuses. Scenarios without a saved row are left out. The pages
   * use `run.canExecuteSteps` to decide whether their Run buttons work.
   */
  async findScenarioStatuses(
    certificationRun: Pick<CertificationRun, 'certificationRunId' | 'status'>,
  ): Promise<CertificationScenarioStatusesDto> {
    const rows = await this.runScenarioRepository.find({
      where: { certificationRunId: certificationRun.certificationRunId },
    });

    return toCertificationScenarioStatusesDto({
      run: {
        runId: certificationRun.certificationRunId,
        status: certificationRun.status,
        canExecuteSteps: canExecuteSteps(certificationRun.status),
      },
      scenarios: rows.map((row) => ({
        scenarioId: row.scenarioId,
        status: row.status as CertificationScenarioStatusDto['status'],
      })),
    });
  }

  /**
   * The decrypted response snapshot of one step's latest run (AC-690). A run that received a
   * response but has no snapshot had it cleared when the request was decided (AC-660).
   */
  async findStepSnapshot(params: {
    certificationRunId: number;
    stepId: number;
  }): Promise<CertificationStepSnapshotDto> {
    const stepRun = await this.stepRunRepository.findOne({
      where: { stepId: params.stepId, certificationRunId: params.certificationRunId },
      select: { stepRunId: true, responseStatus: true, responseSnapshot: true },
    });
    if (!stepRun) throw new NotFoundException();

    const snapshot = stepRun.responseSnapshot;
    if (snapshot) return toCertificationStepSnapshotDto(snapshot);
    return toCertificationStepSnapshotDto({
      state:
        stepRun.responseStatus === null ? CERT_SNAPSHOT_STATE.none : CERT_SNAPSHOT_STATE.deleted,
    });
  }
}
