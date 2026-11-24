import {
  CERT_FORMER_REVIEWER_NAME,
  CERT_MODEL,
  CERT_RUN_STATUS,
  CertificationLatestRunDto,
  CertificationRunCommentDto,
  CertificationRunDto,
  CertificationRunHistoryRowDto,
  CertModel,
  Ids,
  SUPPORTED_CERT_MODELS,
  canExecuteSteps,
  isOpenRunStatus,
  toCertificationLatestRunDto,
  toCertificationRunCommentDto,
  toCertificationRunDto,
  toCertificationRunHistoryDto,
} from '@edanalytics/models';
import {
  CatalogVersion,
  CertificationRun,
  CertificationRunComment,
  CertificationRunScenario,
  EdfiTenant,
  Ods,
  SbEnvironment,
  ScenarioCatalog,
} from '@edanalytics/models-server';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
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
    @InjectRepository(CertificationRunComment)
    private readonly commentRepository: Repository<CertificationRunComment>,
    @InjectRepository(ScenarioCatalog)
    private readonly scenarioRepository: Repository<ScenarioCatalog>,
    @InjectRepository(CertificationRunScenario)
    private readonly runScenarioRepository: Repository<CertificationRunScenario>,
  ) {}

  /**
   * Every run of the team on a data store the user may read, newest first, each with how many of
   * its catalog's enabled scenarios have completed. Counts are two grouped queries, not one per run.
   */
  async findTeamRunHistory(params: {
    teamId: number;
    validOdsIds: (edfiTenantId: number) => Ids | undefined;
  }): Promise<CertificationRunHistoryRowDto[]> {
    const allRuns = await this.runRepository.find({
      where: { teamId: params.teamId, odsId: Not(IsNull()) },
      relations: { ods: true, edfiTenant: { sbEnvironment: true } },
      order: { certificationRunId: 'DESC' },
    });
    const runs = allRuns.filter((run) => {
      const ids = params.validOdsIds(run.edfiTenantId);
      return ids !== undefined && run.odsId !== null && checkId(run.odsId, ids);
    });
    if (runs.length === 0) return [];

    const catalogVersionIds = [
      ...new Set(runs.map((run) => run.catalogVersionId).filter((id): id is number => id !== null)),
    ];
    type TotalRow = { catalogVersionId: number | string; total: number | string };
    const totalsQuery: Promise<TotalRow[]> =
      catalogVersionIds.length === 0
        ? Promise.resolve([])
        : this.scenarioRepository
            .createQueryBuilder('scenario')
            .innerJoin('scenario.domain', 'domain')
            .select('domain.catalogVersionId', 'catalogVersionId')
            .addSelect('COUNT(*)', 'total')
            .where(
              'scenario.isEnabled = :enabled AND domain.isEnabled = :enabled AND domain.catalogVersionId IN (:...catalogVersionIds)',
              { enabled: true, catalogVersionIds },
            )
            .groupBy('domain.catalogVersionId')
            .getRawMany<TotalRow>();
    const [totalRows, completedRows] = await Promise.all([
      totalsQuery,
      this.runScenarioRepository
        .createQueryBuilder('runScenario')
        .innerJoin('runScenario.scenario', 'scenario')
        .innerJoin('scenario.domain', 'domain')
        .select('runScenario.certificationRunId', 'runId')
        .addSelect('COUNT(*)', 'completed')
        .where(
          'runScenario.status = :status AND scenario.isEnabled = :enabled AND domain.isEnabled = :enabled AND runScenario.certificationRunId IN (:...runIds)',
          { status: 'completed', enabled: true, runIds: runs.map((run) => run.certificationRunId) },
        )
        .groupBy('runScenario.certificationRunId')
        .getRawMany<{ runId: number | string; completed: number | string }>(),
    ]);

    // COUNT comes back as a string on pgsql and a number on mssql.
    const totalByCatalog = new Map(
      totalRows.map((row) => [Number(row.catalogVersionId), Number(row.total)]),
    );
    const completedByRun = new Map(
      completedRows.map((row) => [Number(row.runId), Number(row.completed)]),
    );

    return toCertificationRunHistoryDto(
      runs.map((run) => ({
        runId: run.certificationRunId,
        edfiTenantId: run.edfiTenantId,
        odsId: run.odsId as number,
        environmentName: run.edfiTenant?.sbEnvironment?.displayName ?? '',
        tenantName: run.edfiTenant?.displayName ?? '',
        dataStoreName: run.ods?.displayName ?? '',
        certificationModel: run.certificationModel,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        completedScenarios: completedByRun.get(run.certificationRunId) ?? 0,
        totalScenarios:
          run.catalogVersionId === null ? 0 : (totalByCatalog.get(run.catalogVersionId) ?? 0),
      })),
    );
  }

  async findRunComments(runId: number): Promise<CertificationRunCommentDto[]> {
    const comments = await this.commentRepository.find({
      where: { certificationRunId: runId, text: Not(IsNull()) },
      relations: { author: true },
      order: { createdAt: 'DESC', certificationRunCommentId: 'DESC' },
    });
    return comments.map((comment) =>
      toCertificationRunCommentDto({
        commentId: comment.certificationRunCommentId,
        createdAt: comment.createdAt.toISOString(),
        reviewerName: comment.author?.displayName ?? CERT_FORMER_REVIEWER_NAME,
        decision: comment.decision,
        text: comment.text,
      }),
    );
  }

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
    if (!currentRef) throw new ServiceUnavailableException(CERT_RUN_MESSAGES.runtimeNotReady);
    // Catalogs are named by data standard major (v5), so the environment picks its own. Taking
    // whichever is newest would give a 6.x environment a run with no scenarios that fit it.
    const major = Number.parseInt(sbEnvironment.odsDsVersion ?? '', 10);
    const catalogVersion = Number.isInteger(major)
      ? await this.catalogVersionRepository.findOne({
          where: { isActive: true, artifactVersion: currentRef, dataStandardVersion: `v${major}` },
          order: { catalogVersionId: 'DESC' },
        })
      : null;
    if (!catalogVersion) {
      // Scenarios still loading is worth retrying; a data standard with none is not.
      const loaded = await this.catalogVersionRepository.findOne({
        where: { isActive: true, artifactVersion: currentRef },
      });
      throw loaded
        ? new ValidationHttpException(
            CERT_RUN_MESSAGES.unsupportedDataStandard(sbEnvironment.odsDsVersion),
          )
        : new ServiceUnavailableException(CERT_RUN_MESSAGES.runtimeNotReady);
    }

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
      // Only what toDto reads. Not a spread of the entity (its displayName is a getter that a
      // spread drops), and not Object.assign, which would change the request's own entity.
      edfiTenant: { displayName: edfiTenant.displayName, sbEnvironment },
    });
  }

  /** The newest run of each Certification Model on a data store, whichever team started it. */
  async findLatestRuns(params: {
    edfiTenantId: number;
    odsId: number;
  }): Promise<CertificationLatestRunDto[]> {
    // One row per model, so the work doesn't grow with the data store's run history.
    const newest = await Promise.all(
      Object.values(CERT_MODEL).map((certificationModel) =>
        this.runRepository.findOne({
          where: { edfiTenantId: params.edfiTenantId, odsId: params.odsId, certificationModel },
          order: { certificationRunId: 'DESC' },
        }),
      ),
    );
    return toCertificationLatestRunDto(
      newest
        .filter((run): run is CertificationRun => run !== null)
        .map((run) => ({
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
