import {
  CertificationScenarioStatusDto,
  CertificationStepRunsDto,
  isSupportedSisVersion,
  toCertificationScenarioStatusDto,
  toCertificationStepRunsDto,
} from '@edanalytics/models';
import {
  CatalogVersion,
  CertificationProcess,
  CertificationProcessScenario,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
} from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { ArtifactService } from './artifact/artifact.service';
import { CERT_RUN_MESSAGES, isCurrentCatalogVersion } from './certification.service';

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
 * Read-only: it never creates a certification process and never contacts the ODS/API.
 */
@Injectable()
export class CertificationStepRunsService {
  constructor(
    @InjectRepository(ScenarioCatalog)
    private readonly scenarioRepository: Repository<ScenarioCatalog>,
    @InjectRepository(CertificationProcess)
    private readonly processRepository: Repository<CertificationProcess>,
    @InjectRepository(CertificationProcessScenario)
    private readonly processScenarioRepository: Repository<CertificationProcessScenario>,
    @InjectRepository(ScenarioStep)
    private readonly stepRunRepository: Repository<ScenarioStep>,
    @InjectRepository(ScenarioStepError)
    private readonly stepErrorRepository: Repository<ScenarioStepError>,
    @InjectRepository(CatalogVersion)
    private readonly catalogVersionRepository: Repository<CatalogVersion>,
    private readonly artifactService: ArtifactService,
  ) {}

  async findStepRuns(params: FindStepRunsParams): Promise<CertificationStepRunsDto> {
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }

    // runStep keys the process on step.scenario.area.catalogVersionId; take the same value
    // from the requested scenario so a read always finds the process a run wrote.
    const scenario = await this.scenarioRepository.findOne({
      where: { scenarioId: params.scenarioId },
      relations: { area: { catalogVersion: true } },
    });
    if (!scenario || scenario.area.catalogVersion.dataStandardVersion !== params.sisVersion) {
      return EMPTY;
    }

    const certificationProcess = await this.processRepository.findOne({
      where: {
        edfiTenantId: params.edfiTenantId,
        odsId: params.odsId ?? IsNull(),
        catalogVersionId: scenario.area.catalogVersionId,
      },
    });
    if (!certificationProcess) return EMPTY;

    const { certificationProcessId } = certificationProcess;
    const { scenarioId } = params;
    const [stepRuns, scenarioRow] = await Promise.all([
      this.stepRunRepository.find({ where: { certificationProcessId, scenarioId } }),
      this.processScenarioRepository.findOne({ where: { certificationProcessId, scenarioId } }),
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
        errors: errors
          .filter((error) => error.stepRunId === stepRun.stepRunId)
          .map((error) => ({
            property: error.property ?? '',
            validation: error.validation ?? '',
            error: error.description ?? '',
          })),
      })),
    });
  }

  /**
   * Every scenario's saved status for the current catalog version, read-only: it never
   * creates a certification process. Scenarios without a saved row are left out.
   */
  async findScenarioStatuses(
    params: FindScenarioStatusesParams,
  ): Promise<CertificationScenarioStatusDto[]> {
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }

    const catalogVersions = await this.catalogVersionRepository.find({
      where: { dataStandardVersion: params.sisVersion, isActive: true },
    });
    const catalogVersion = catalogVersions.find((version) =>
      isCurrentCatalogVersion(version, params.sisVersion, this.artifactService.currentRef),
    );
    if (!catalogVersion) return [];

    const certificationProcess = await this.processRepository.findOne({
      where: {
        edfiTenantId: params.edfiTenantId,
        odsId: params.odsId ?? IsNull(),
        catalogVersionId: catalogVersion.catalogVersionId,
      },
    });
    if (!certificationProcess) return [];

    const rows = await this.processScenarioRepository.find({
      where: { certificationProcessId: certificationProcess.certificationProcessId },
    });

    return toCertificationScenarioStatusDto(
      rows.map((row) => ({
        scenarioId: row.scenarioId,
        status: row.status as CertificationScenarioStatusDto['status'],
      })),
    );
  }
}
