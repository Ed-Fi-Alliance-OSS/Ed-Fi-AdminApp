import {
  CERT_PROCESS_STATUS,
  CERT_SCENARIO_STATUS,
  CERT_STEP_STATUS,
  CertificationStepRunDto,
  CertScenarioStatus,
  isSupportedSisVersion,
} from '@edanalytics/models';
import {
  CertificationProcess,
  CertificationProcessScenario,
  EdfiTenant,
  SbEnvironment,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
  StepParameterCatalog,
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
import { DataSource, IsNull, Repository } from 'typeorm';
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
import { createRunWorkspace } from './runner/run-workspace';
import { validateStepInputs } from './runner/step-inputs';

export const CERT_RUN_MESSAGES = {
  runtimeNotReady:
    "Certification isn't available yet because its test scenarios are still loading. Try again in a minute.",
  unsupportedVersion: "This SIS version isn't supported yet. Supported: v5.",
  busyScenario: 'Another step of this scenario is running. Wait for it to finish, then try again.',
  atCapacity: 'Too many certification steps are running right now. Try again in a minute.',
};

export interface RunStepParams {
  sbEnvironment: SbEnvironment;
  edfiTenant: EdfiTenant;
  sisVersion: string;
  stepId: number;
  odsId?: number;
  token: string;
  inputs: Record<string, string>;
}

/** A scenario passes when all its enabled steps pass; any failed step fails it. */
export const deriveScenarioStatus = (
  enabledStepIds: number[],
  runs: { stepId: number; status: string }[]
): CertScenarioStatus => {
  if (runs.some((run) => run.status === CERT_STEP_STATUS.failed)) return CERT_SCENARIO_STATUS.failed;
  const passed = new Set(
    runs.filter((run) => run.status === CERT_STEP_STATUS.success).map((run) => run.stepId)
  );
  return enabledStepIds.every((stepId) => passed.has(stepId))
    ? CERT_SCENARIO_STATUS.completed
    : CERT_SCENARIO_STATUS.inprogress;
};

const isSslVerificationDisabled = () =>
  config.SSL_VERIFICATION === false || config.SSL_VERIFICATION === 'false';

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);
  private readonly runLimiter = new RunLimiter(Number(config.CERT_BRUNO_MAX_CONCURRENT_RUNS ?? 2));

  constructor(
    private readonly artifactService: ArtifactService,
    private readonly targetService: CertificationTargetService,
    @InjectRepository(StepCatalog)
    private readonly stepRepository: Repository<StepCatalog>,
    @InjectRepository(StepParameterCatalog)
    private readonly parameterRepository: Repository<StepParameterCatalog>,
    @InjectRepository(CertificationProcess)
    private readonly processRepository: Repository<CertificationProcess>,
    @InjectRepository(CertificationProcessScenario)
    private readonly processScenarioRepository: Repository<CertificationProcessScenario>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Runs one catalog step with the artifact's Bruno CLI against the tenant's ODS/API (AC-466)
   * and saves the result. The token is used only for this run and is never stored or logged.
   */
  async runStep(params: RunStepParams): Promise<CertificationStepRunDto> {
    if (!this.artifactService.isRunTimeReady) {
      throw new ServiceUnavailableException(CERT_RUN_MESSAGES.runtimeNotReady);
    }
    if (!isSupportedSisVersion(params.sisVersion)) {
      throw new ValidationHttpException(CERT_RUN_MESSAGES.unsupportedVersion);
    }

    const step = await this.findRunnableStep(params.stepId, params.sisVersion);
    const inputNames = (
      await this.parameterRepository.find({ where: { stepId: step.stepId, type: 'input' } })
    ).map((parameter) => parameter.name);
    const inputErrors = validateStepInputs(inputNames, params.inputs);
    if (inputErrors.length > 0) {
      throw new ValidationHttpException(...inputErrors);
    }

    const target = await this.targetService.resolve({
      sbEnvironment: params.sbEnvironment,
      edfiTenant: params.edfiTenant,
      odsId: params.odsId,
    });
    const certificationProcess = await this.findOrCreateProcess(
      params.edfiTenant.id,
      params.odsId ?? null,
      step.scenario.area.catalogVersionId
    );

    const slot = this.runLimiter.tryAcquire(
      `${certificationProcess.certificationProcessId}:${step.scenarioId}`
    );
    if (slot === 'busy-key') throw new ConflictException(CERT_RUN_MESSAGES.busyScenario);
    if (slot === 'at-capacity') throw new ServiceUnavailableException(CERT_RUN_MESSAGES.atCapacity);
    try {
      const parsed = await this.execute(step, certificationProcess, target, params);
      return await this.saveResult(step, certificationProcess, params.inputs, parsed);
    } finally {
      slot.release();
    }
  }

  /** The catalog is the allowlist: only enabled steps of the active catalog for this version and artifact run. */
  private async findRunnableStep(stepId: number, sisVersion: string): Promise<StepCatalog> {
    const step = await this.stepRepository.findOne({
      where: { stepId },
      relations: { scenario: { area: { catalogVersion: true } } },
    });
    if (!step) throw new NotFoundException();
    const { scenario } = step;
    const { area } = scenario;
    const { catalogVersion } = area;
    const runnable =
      step.isEnabled &&
      scenario.isEnabled &&
      area.isEnabled &&
      catalogVersion.isActive &&
      catalogVersion.dataStandardVersion === sisVersion &&
      catalogVersion.artifactVersion === this.artifactService.currentRef;
    if (!runnable) throw new NotFoundException();
    return step;
  }

  private async findOrCreateProcess(
    edfiTenantId: number,
    odsId: number | null,
    catalogVersionId: number
  ): Promise<CertificationProcess> {
    const where = { edfiTenantId, odsId: odsId ?? IsNull(), catalogVersionId };
    const existing = await this.processRepository.findOne({ where });
    if (existing) return existing;
    try {
      return await this.processRepository.save(
        this.processRepository.create({
          edfiTenantId,
          odsId,
          catalogVersionId,
          status: CERT_PROCESS_STATUS.inprogress,
        })
      );
    } catch (error) {
      // Two first runs can race; the unique index lets only one insert win.
      const created = await this.processRepository.findOne({ where });
      if (created) return created;
      throw error;
    }
  }

  private async execute(
    step: StepCatalog,
    certificationProcess: CertificationProcess,
    target: CertificationTarget,
    { token, inputs }: RunStepParams
  ): Promise<ParsedBrunoReport> {
    const scenarioRow = await this.processScenarioRepository.findOne({
      where: {
        certificationProcessId: certificationProcess.certificationProcessId,
        scenarioId: step.scenarioId,
      },
    });
    const timeoutMs = Number(config.CERT_BRUNO_RUN_TIMEOUT_MS ?? 60000);
    const startedAt = Date.now();
    const workspace = await createRunWorkspace({
      sisRoot: this.artifactService.sisRoot,
      stepSegments: [
        step.scenario.area.catalogVersion.dataStandardVersion,
        step.scenario.area.name,
        step.scenario.name,
        step.fileName,
      ],
      inputs,
      resourceBaseUrl: target.resourceBaseUrl,
      oauthUrl: target.oauthUrl,
      tokenExpiresAt: Math.floor((startedAt + timeoutMs) / 1000) + 60,
      restoredVars: sanitizeCapturedVars(scenarioRow?.capturedVars ?? {}) ?? {},
    });

    try {
      const cli = await runBrunoCli({
        cliPath: this.artifactService.brunoCliPath,
        cwd: workspace.dir,
        args: buildBrunoArgs({ stepPath: workspace.stepPath, insecure: isSslVerificationDisabled() }),
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
          `complete=${parsed.complete} passed=${parsed.passed} ms=${Date.now() - startedAt}`
      );
      if (!parsed.complete && cli.stderrTail) {
        this.logger.warn(`Certification step ${step.stepId} stderr: ${cleanMessage(cli.stderrTail, token)}`);
      }
      return parsed;
    } finally {
      await workspace.dispose();
    }
  }

  /** One transaction: replace the step's row and errors, then update the scenario. */
  private saveResult(
    step: StepCatalog,
    certificationProcess: CertificationProcess,
    inputs: Record<string, string>,
    parsed: ParsedBrunoReport
  ): Promise<CertificationStepRunDto> {
    const { certificationProcessId } = certificationProcess;
    const { stepId, scenarioId } = step;
    const ranAt = new Date();
    const status = parsed.passed ? CERT_STEP_STATUS.success : CERT_STEP_STATUS.failed;

    return this.dataSource.transaction(async (em) => {
      const stepRuns = em.getRepository(ScenarioStep);
      const existing = await stepRuns.findOne({ where: { certificationProcessId, stepId } });
      const stepRun = await stepRuns.save(
        Object.assign(existing ?? stepRuns.create({ certificationProcessId, scenarioId, stepId }), {
          status,
          inputs,
          runAt: ranAt,
        })
      );

      const errors = em.getRepository(ScenarioStepError);
      await errors.delete({ stepRunId: stepRun.stepRunId });
      if (parsed.errors.length > 0) {
        await errors.save(
          parsed.errors.map((error) => ({
            stepRunId: stepRun.stepRunId,
            property: error.property,
            validation: error.validation,
            description: error.error,
          }))
        );
      }

      const enabledStepIds = (
        await em.getRepository(StepCatalog).find({ where: { scenarioId, isEnabled: true } })
      ).map((catalogStep) => catalogStep.stepId);
      const runs = await stepRuns.find({ where: { certificationProcessId, scenarioId } });
      const scenarioStatus = deriveScenarioStatus(enabledStepIds, runs);

      const scenarios = em.getRepository(CertificationProcessScenario);
      const scenarioRow =
        (await scenarios.findOne({ where: { certificationProcessId, scenarioId } })) ??
        scenarios.create({ certificationProcessId, scenarioId, capturedVars: null });
      scenarioRow.status = scenarioStatus;
      if (parsed.complete && parsed.capturedVars) {
        scenarioRow.capturedVars = parsed.capturedVars;
      }
      await scenarios.save(scenarioRow);
      await em.getRepository(CertificationProcess).update({ certificationProcessId }, { updatedAt: ranAt });

      return { stepId, status, ranAt: ranAt.toISOString(), scenarioStatus, errors: parsed.errors };
    });
  }
  //   // ------------------------------------------------------------------------------
  //   // @TODO: The underlying methods were copied from the original POC and will be refactored in Certification 2.2
  //   // ------------------------------------------------------------------------------

  //   // Run Bruno against a folder. Returns raw stdout and exit code
  //   async runBruno(folder: string, env?: string): Promise<{ exitCode: number; output: string }> {
  //     env = env || this.brunoEnv;

  //     // Run from the Bruno collection root whenever available.
  //     const collectionRoot = path.join(this.runtimeRoot, this.collectionRootName);
  //     const cwd = fs.existsSync(path.join(collectionRoot, 'bruno.json')) ? collectionRoot : this.runtimeRoot;
  //     let target = folder;
  //     try {
  //       const absoluteFolder = path.isAbsolute(folder) ? folder : path.resolve(cwd, folder);
  //       const relativeTarget = path.relative(cwd, absoluteFolder);
  //       if (!relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget)) {
  //         target = relativeTarget || '.';
  //       }
  //     } catch (_) {
  //       // ignore
  //     }

  //     const runtimeBin = path.join(this.runtimeRoot, 'node_modules', '.bin');
  //     const localBru = path.join(runtimeBin, process.platform === 'win32' ? 'bru.cmd' : 'bru');
  //     const hasLocalBru = fs.existsSync(localBru);
  //     const cmd = hasLocalBru ? `${localBru} run "${target}" --env ${env}` : `bru run "${target}" --env ${env}`;
  //     const fallback = `npx -p @usebruno/cli bru run "${target}" --env ${env}`;
  //     this.logger.log(`Running: ${cmd} (cwd: ${cwd})`);

  //     // Persist the exact command and cwd for debugging
  //     try {
  //       const cmdFile = path.join(this.runtimeRoot, 'last-command.txt');
  //       fs.writeFileSync(cmdFile, `cmd: ${cmd}\ncwd: ${cwd}\nfallback: ${fallback}\n`, 'utf8');
  //     } catch (err) {
  //       this.logger.debug(`Failed to write last-command.txt: ${err}`);
  //     }

  //     const spawnEnv = {
  //       ...process.env,
  //       PATH: [runtimeBin, process.env.PATH].filter(Boolean).join(path.delimiter),
  //     };
  //     let proc = hasLocalBru
  //       ? spawnSync(localBru, ['run', target, '--env', env], {
  //         shell: process.platform === 'win32',
  //         encoding: 'utf8',
  //         stdio: 'pipe',
  //         cwd,
  //         timeout: 10 * 60 * 1000,
  //         env: spawnEnv,
  //       })
  //       : spawnSync(fallback, { shell: true, encoding: 'utf8', stdio: 'pipe', cwd, timeout: 10 * 60 * 1000, env: spawnEnv });

  //     if (hasLocalBru && proc?.error) {
  //       this.logger.log(`Local Bruno CLI failed to execute (${proc.error.message}). Trying fallback.`);
  //       proc = spawnSync(fallback, { shell: true, encoding: 'utf8', stdio: 'pipe', cwd, timeout: 10 * 60 * 1000, env: spawnEnv });
  //     }

  //     const output = (proc && proc.stdout ? proc.stdout : '') + '\n' + (proc && proc.stderr ? proc.stderr : '');
  //     this.logger.log(`Bruno exit code: ${proc && proc.status}`);
  //     // Write last-output.txt for debugging
  //     try {
  //       const outFile = path.join(this.runtimeRoot, 'last-output.txt');
  //       fs.writeFileSync(outFile, `cmd: ${cmd}\ncwd: ${cwd}\n\nOUTPUT:\n${output}`, 'utf8');
  //     } catch (err) {
  //       this.logger.debug(`Failed to write last-output.txt: ${err}`);
  //     }

  //     return { exitCode: (proc && typeof proc.status === 'number') ? proc.status : 1, output };
  //   }

  //   // Prepare a working copy of a scenario and apply placeholder replacements
  //   async prepareScenario(scenarioPath: string, params: Record<string, any> = {}): Promise<string> {
  //     const scenarioSrc = path.join(this.runtimeRoot, this.collectionRootName, scenarioPath);
  //     if (!fs.existsSync(scenarioSrc)) {
  //       throw new Error(`Scenario source not found: ${scenarioSrc}`);
  //     }

  //     const workDir = path.join(this.runtimeRoot, this.collectionRootName, 'work', `${Date.now()}`);
  //     this.copyDirRecursive(scenarioSrc, workDir);

  //     // Replace placeholders in .bru and .json files
  //     this.replacePlaceholdersInDir(workDir, params);

  //     // If test-config.json exists, attempt to rewrite meta.seq based on order
  //     const configPath = path.join(workDir, 'test-config.json');
  //     if (fs.existsSync(configPath)) {
  //       try {
  //         const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as any;
  //         if (Array.isArray(cfg.order) && cfg.order.length) {
  //           this.rewriteMetaSeqForOrder(workDir, cfg.order);
  //         }
  //       } catch (err) {
  //         this.logger.warn(`Failed to parse test-config.json: ${err}`);
  //       }
  //     }

  //     return workDir;
  //   }

  //   private replacePlaceholdersInDir(dir: string, params: Record<string, any>) {
  //     const entries = fs.readdirSync(dir, { withFileTypes: true });
  //     for (const entry of entries) {
  //       const p = path.join(dir, entry.name);
  //       if (entry.isDirectory()) {
  //         this.replacePlaceholdersInDir(p, params);
  //         continue;
  //       }
  //       if (!/\.bru$|\.json$/i.test(entry.name)) continue;
  //       let content = fs.readFileSync(p, 'utf8');
  //       for (const [k, v] of Object.entries(params)) {
  //         const val = typeof v === 'string' ? v : JSON.stringify(v);
  //         const normKey = k
  //           .replace(/([a-z])([A-Z])/g, '$1_$2')
  //           .replace(/[^A-Za-z0-9_]/g, '_')
  //           .toUpperCase();

  //         // 1) URL query param occurrences: e.g. schoolId=[...]
  //         const urlRe = new RegExp(`(${this.escapeRegExp(k)}=)([^&\\s\\)\"]*)`, 'gi');
  //         content = content.replace(urlRe, `$1${val}`);

  //         // 2) Params object lines: match only standalone param definitions like "schoolId: ..."
  //         //    Avoid matching property paths (e.g. `res.body[0].schoolId:`) by requiring
  //         //    the param name to be at start of line or preceded by whitespace/{/(, characters.
  //         const propRe = new RegExp(`(^|[\\s{(,])(${this.escapeRegExp(k)})\\s*:\\s*\\[?[^,\\n\\r}]*`, 'gmi');
  //         content = content.replace(propRe, `$1$2: ${val}`);

  //         // 3) Any bracketed token that contains the normalized key, e.g. [ENTER_SCHOOL_ID]
  //         const bracketRe = new RegExp(`\\[[^\\]]*${this.escapeRegExp(normKey)}[^\\]]*\\]`, 'gi');
  //         content = content.replace(bracketRe, val);

  //         // 4) Simple [KEY] pattern
  //         const simpleBr = new RegExp(`\\[${this.escapeRegExp(normKey)}\\]`, 'gi');
  //         content = content.replace(simpleBr, val);

  //       }
  //       fs.writeFileSync(p, content, 'utf8');
  //     }
  //   }

  //   private rewriteMetaSeqForOrder(workDir: string, order: string[]) {
  //     // Map filenames to sequence index
  //     const fileToSeq = new Map<string, number>();
  //     order.forEach((rel, idx) => {
  //       const base = path.basename(rel);
  //       fileToSeq.set(base, idx + 1);
  //     });

  //     const entries = fs.readdirSync(workDir, { withFileTypes: true });
  //     for (const entry of entries) {
  //       if (entry.isFile() && /\.bru$/i.test(entry.name)) {
  //         const full = path.join(workDir, entry.name);
  //         let content = fs.readFileSync(full, 'utf8');
  //         const seq = fileToSeq.get(entry.name);
  //         if (seq !== undefined) {
  //           // Try to replace common patterns: "meta":{"seq":<num>} or meta.seq = <num>
  //           content = content.replace(/("meta"\s*:\s*\{[^}]*"seq"\s*:\s*)\d+/i, `$1${seq}`);
  //           content = content.replace(/(meta\.seq\s*=\s*)\d+/i, `$1${seq}`);
  //           fs.writeFileSync(full, content, 'utf8');
  //         }
  //       }
  //     }
  //   }

  //   private copyDirRecursive(src: string, dest: string) {
  //     const entries = fs.readdirSync(src, { withFileTypes: true });
  //     fs.mkdirSync(dest, { recursive: true });
  //     for (const entry of entries) {
  //       if (entry.name === 'node_modules' || entry.name === '.git') continue;
  //       const srcPath = path.join(src, entry.name);
  //       const destPath = path.join(dest, entry.name);
  //       if (entry.isDirectory()) {
  //         this.copyDirRecursive(srcPath, destPath);
  //       } else if (entry.isFile()) {
  //         fs.copyFileSync(srcPath, destPath);
  //       }
  //     }
  //   }

  //   private escapeRegExp(str: string) {
  //     return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  //   }
  // }
}
