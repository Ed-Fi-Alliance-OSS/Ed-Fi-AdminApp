import {
  CERT_RUN_STATUS,
  CertificationLatestRunDto,
  CertificationRunDto,
  CertModel,
  Ids,
  SUPPORTED_CERT_MODELS,
  canExecuteSteps,
  isOpenRunStatus,
  toCertificationLatestRunDto,
  toCertificationRunDto,
} from '@edanalytics/models';
import {
  CatalogVersion,
  CertificationRun,
  EdfiTenant,
  Ods,
  SbEnvironment,
} from '@edanalytics/models-server';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { checkId } from '../auth/helpers/where-ids';
import { ValidationHttpException } from '../utils';
import { ArtifactService } from './artifact/artifact.service';
import { CERT_RUN_MESSAGES, openRunWhere } from './certification.service';

export interface CreateRunParams {
  teamId: number;
  sbEnvironment: SbEnvironment;
  edfiTenant: EdfiTenant;
  odsId: number;
  certificationModel: CertModel;
  /** The signed-in user, recorded as the run's creator. */
  userId: number | null;
}

export interface FindTeamRunParams {
  runId: number;
  teamId: number;
  /** Given by the tenant-scoped routes, so a run can't be read through another tenant's URL. */
  edfiTenantId?: number;
  /** The data stores the user's certification privilege covers in the given (the run's) tenant. */
  validOdsIds: (edfiTenantId: number) => Ids | undefined;
}

/** Starts certification runs and finds them for a team (AC-651). */
@Injectable()
export class CertificationRunsService {
  constructor(
    private readonly artifactService: ArtifactService,
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>,
    @InjectRepository(Ods)
    private readonly odsRepository: Repository<Ods>,
    @InjectRepository(CatalogVersion)
    private readonly catalogVersionRepository: Repository<CatalogVersion>,
  ) {}

  /**
   * Creates a Draft run of one Certification Model on one data store. A data store has at most
   * one open run per model, so a second one is refused with 409.
   */
  async createRun(params: CreateRunParams): Promise<CertificationRunDto> {
    const { teamId, sbEnvironment, edfiTenant, odsId, certificationModel, userId } = params;
    if (!SUPPORTED_CERT_MODELS.includes(certificationModel)) {
      throw new ValidationHttpException({
        field: 'certificationModel',
        message: CERT_RUN_MESSAGES.unsupportedModel,
      });
    }
    const ods = await this.odsRepository.findOneBy({ id: odsId, edfiTenantId: edfiTenant.id });
    if (!ods) throw new NotFoundException();

    // The run records the catalog it was started with; without one there are no scenarios to run.
    const currentRef = this.artifactService.currentRef;
    const catalogVersion = currentRef
      ? await this.catalogVersionRepository.findOne({
          where: { isActive: true, artifactVersion: currentRef },
          order: { catalogVersionId: 'DESC' },
        })
      : null;
    if (!catalogVersion) throw new ServiceUnavailableException(CERT_RUN_MESSAGES.runtimeNotReady);

    const where = openRunWhere(edfiTenant.id, odsId, certificationModel);
    const alreadyOpen = () => new ConflictException(CERT_RUN_MESSAGES.alreadyOpen(certificationModel));
    if (await this.runRepository.findOne({ where })) throw alreadyOpen();

    let created: CertificationRun;
    try {
      created = await this.runRepository.save(
        this.runRepository.create({
          edfiTenantId: edfiTenant.id,
          odsId,
          certificationModel,
          catalogVersionId: catalogVersion.catalogVersionId,
          createdById: userId,
          teamId,
          status: CERT_RUN_STATUS.DRAFT,
        }),
      );
    } catch (error) {
      // Two Start Run requests can race; the unique index lets only one insert win.
      if (await this.runRepository.findOne({ where })) throw alreadyOpen();
      throw error;
    }
    return this.toDto({
      ...created,
      catalogVersion,
      ods,
      edfiTenant: Object.assign(edfiTenant, { sbEnvironment }),
    });
  }

  /** The newest run of each Certification Model on a data store, whichever team started it. */
  async findLatestRuns(params: {
    edfiTenantId: number;
    odsId: number;
  }): Promise<CertificationLatestRunDto[]> {
    const runs = await this.runRepository.find({
      where: { edfiTenantId: params.edfiTenantId, odsId: params.odsId },
      order: { certificationRunId: 'DESC' },
    });
    const latest = new Map<CertModel, CertificationRun>();
    for (const run of runs) {
      if (!latest.has(run.certificationModel)) latest.set(run.certificationModel, run);
    }
    return toCertificationLatestRunDto(
      [...latest.values()].map((run) => ({
        certificationModel: run.certificationModel,
        runId: run.certificationRunId,
        status: run.status,
        isOpen: isOpenRunStatus(run.status),
      })),
    );
  }

  /**
   * One run of the team. Anything the user may not see is a 404, the same as a run that
   * doesn't exist, so a run ID can't be probed.
   */
  async findTeamRun(params: FindTeamRunParams): Promise<CertificationRun> {
    const { runId, teamId, edfiTenantId, validOdsIds } = params;
    const certificationRun = await this.runRepository.findOne({
      where: {
        certificationRunId: runId,
        teamId,
        ...(edfiTenantId !== undefined && { edfiTenantId }),
      },
      relations: { catalogVersion: true, ods: true, edfiTenant: { sbEnvironment: true } },
    });
    if (!certificationRun || certificationRun.odsId === null) throw new NotFoundException();
    const ids = validOdsIds(certificationRun.edfiTenantId);
    if (ids === undefined || !checkId(certificationRun.odsId, ids)) throw new NotFoundException();
    return certificationRun;
  }

  /** Needs the relations findTeamRun loads. */
  toDto(
    certificationRun: Pick<
      CertificationRun,
      'certificationRunId' | 'edfiTenantId' | 'odsId' | 'certificationModel' | 'status'
    > & {
      catalogVersion: Pick<CatalogVersion, 'dataStandardVersion'> | null;
      ods: Pick<Ods, 'displayName'> | null;
      edfiTenant: Pick<EdfiTenant, 'displayName'> & {
        sbEnvironment: Pick<SbEnvironment, 'id' | 'displayName'>;
      };
    },
  ): CertificationRunDto {
    const { edfiTenant } = certificationRun;
    return toCertificationRunDto({
      runId: certificationRun.certificationRunId,
      sbEnvironmentId: edfiTenant.sbEnvironment.id,
      edfiTenantId: certificationRun.edfiTenantId,
      odsId: certificationRun.odsId as number,
      environmentName: edfiTenant.sbEnvironment.displayName,
      tenantName: edfiTenant.displayName,
      dataStoreName: certificationRun.ods?.displayName ?? '',
      certificationModel: certificationRun.certificationModel,
      status: certificationRun.status,
      canExecuteSteps: canExecuteSteps(certificationRun.status),
      dataStandardVersion: certificationRun.catalogVersion?.dataStandardVersion ?? null,
    });
  }
}
