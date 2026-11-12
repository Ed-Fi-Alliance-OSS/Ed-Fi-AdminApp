import {
  CERT_MODEL,
  CERT_SNAPSHOT_STATE,
  CertificationScenarioStatusDto,
  CertificationScenarioStatusesDto,
  CertificationStepRunsDto,
  CertificationStepSnapshotDto,
  CertStepErrorKind,
  canExecuteSteps,
  isSupportedSisVersion,
  toCertificationScenarioStatusesDto,
  toCertificationStepRunsDto,
  toCertificationStepSnapshotDto,
} from '@edanalytics/models';
import {
  CertificationRun,
  CertificationRunScenario,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
} from '@edanalytics/models-server';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { CERT_RUN_MESSAGES, openRunWhere } from './certification.service';

export interface FindStepRunsParams {
  edfiTenantId: number;
  odsId: number | null;
  sisVersion: string;
  scenarioId: number;
}

export interface FindScenarioStatusesParams {
  edfiTenantId: number;
  odsId: number | null;
  sisVersion: string;
}

const EMPTY: CertificationStepRunsDto = { scenarioStatus: null, steps: [] };

/**
 * Reads the saved step results that CertificationService.runStep writes (AC-475).
 * Read-only: it never creates a certification run and never contacts the ODS/API.
 * Every read is of the data store's open SIS run, so a finished (Approved or Rejected) run's
 * results never show under the run that follows it.
 */
@Injectable()
export class CertificationStepRunsService {
  constructor(
    @InjectRepository(ScenarioCatalog)
    private readonly scenarioRepository: Repository<ScenarioCatalog>,
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>,
    @InjectRepository(CertificationRunScenario)
    private readonly runScenarioRepository: Repository<CertificationRunScenario>,
    @InjectRepository(ScenarioStep)
    private readonly stepRunRepository: Repository<ScenarioStep>,
    @InjectRepository(ScenarioStepError)
    private readonly stepErrorRepository: Repository<ScenarioStepError>,
  ) {}

  async findStepRuns(params: FindStepRunsParams): Promise<CertificationStepRunsDto> {
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }

    // The scenario is read only to check that it belongs to the requested SIS version.
    const scenario = await this.scenarioRepository.findOne({
      where: { scenarioId: params.scenarioId },
      relations: { domain: { catalogVersion: true } },
    });
    if (!scenario || scenario.domain.catalogVersion.dataStandardVersion !== params.sisVersion) {
      return EMPTY;
    }

    const certificationRun = await this.runRepository.findOne({
      where: openRunWhere(params.edfiTenantId, params.odsId, CERT_MODEL.sis),
    });
    if (!certificationRun) return EMPTY;

    const { certificationRunId } = certificationRun;
    const { scenarioId } = params;
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
   * The data store's open SIS run and its scenario statuses, read-only: it never creates a
   * run. With no open run there are no statuses, because the next step run starts a new run.
   * Scenarios without a saved row are left out. The pages use `run.canExecuteSteps` to decide
   * whether their Run buttons work.
   */
  async findScenarioStatuses(
    params: FindScenarioStatusesParams,
  ): Promise<CertificationScenarioStatusesDto> {
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }

    const certificationRun = await this.runRepository.findOne({
      where: openRunWhere(params.edfiTenantId, params.odsId, CERT_MODEL.sis),
    });
    if (!certificationRun) return toCertificationScenarioStatusesDto({ run: null, scenarios: [] });

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
  async findStepSnapshot(
    params: Omit<FindStepRunsParams, 'scenarioId'> & { stepId: number },
  ): Promise<CertificationStepSnapshotDto> {
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }
    const stepRun = await this.stepRunRepository.findOne({
      where: {
        stepId: params.stepId,
        certificationRun: openRunWhere(params.edfiTenantId, params.odsId, CERT_MODEL.sis),
      },
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
