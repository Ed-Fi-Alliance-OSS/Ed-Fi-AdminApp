import {
  CertificationStepRunsDto,
  isSupportedSisVersion,
  toCertificationStepRunsDto,
} from '@edanalytics/models';
import {
  CatalogVersion,
  CertificationProcess,
  CertificationProcessScenario,
  ScenarioStep,
  ScenarioStepError,
} from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { ArtifactService } from './artifact/artifact.service';
import { CERT_RUN_MESSAGES } from './certification.service';

export interface FindStepRunsParams {
  edfiTenantId: number;
  odsId: number | null;
  sisVersion: string;
  scenarioId: number;
}

const EMPTY: CertificationStepRunsDto = { scenarioStatus: null, steps: [] };

/**
 * Reads the saved step results that CertificationService.runStep writes (AC-475).
 * Read-only: it never creates a certification process and never contacts the ODS/API.
 */
@Injectable()
export class CertificationStepRunsService {
  constructor(
    private readonly artifactService: ArtifactService,
    @InjectRepository(CatalogVersion)
    private readonly catalogVersionRepository: Repository<CatalogVersion>,
    @InjectRepository(CertificationProcess)
    private readonly processRepository: Repository<CertificationProcess>,
    @InjectRepository(CertificationProcessScenario)
    private readonly processScenarioRepository: Repository<CertificationProcessScenario>,
    @InjectRepository(ScenarioStep)
    private readonly stepRunRepository: Repository<ScenarioStep>,
    @InjectRepository(ScenarioStepError)
    private readonly stepErrorRepository: Repository<ScenarioStepError>,
  ) {}

  async findStepRuns(params: FindStepRunsParams): Promise<CertificationStepRunsDto> {
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }

    // The same catalog match runStep uses, so reads and runs share one process.
    const catalogVersion = await this.catalogVersionRepository.findOne({
      where: {
        isActive: true,
        dataStandardVersion: params.sisVersion,
        artifactVersion: this.artifactService.currentRef,
      },
    });
    if (!catalogVersion) return EMPTY;

    const certificationProcess = await this.processRepository.findOne({
      where: {
        edfiTenantId: params.edfiTenantId,
        odsId: params.odsId ?? IsNull(),
        catalogVersionId: catalogVersion.catalogVersionId,
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
}
