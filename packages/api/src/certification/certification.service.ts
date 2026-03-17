import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as config from 'config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import AdmZip from 'adm-zip';

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);
  private readonly runtimeRoot: string;
  private readonly collectionRootName = 'SIS';
  private readonly BASE_URL = 'https://github.com/Ed-Fi-Alliance-OSS/certification-testing/releases/download';
  private readonly brunoEnv = 'ODS';
  
  // GitHub release ref used for artifact download and runtime cache matching.
  private readonly targetDownloadRef: string | undefined;
  // Expected SHA-256 hex of the downloaded ZIP.
  private readonly expectedChecksum: string | undefined;
  // Controls startup behaviour when download fails: 'error' | 'warning'.
  private readonly onDownloadError: string;
  
  private isRuntimeReady = false;

  constructor() {
    this.runtimeRoot = path.resolve(process.cwd(), 'packages', 'api', 'certification', 'bruno');
    this.targetDownloadRef = config.CERT_BRUNO_SRC_REF ? String(config.CERT_BRUNO_SRC_REF).trim() : undefined;
    this.expectedChecksum = config.CERT_BRUNO_SRC_CHECKSUM;
    this.onDownloadError = config.CERT_BRUNO_ON_DOWNLOAD_ERROR || 'error';

    if (!this.targetDownloadRef) {
      const msg =
        'Certification artifact ref is not configured. ' +
        'Set CERT_BRUNO_SRC_REF.';
      if (this.onDownloadError !== 'warning') {
        throw new Error(msg);
      }
      this.logger.warn(msg);
    }

    if (!this.expectedChecksum) {
      const msg =
        'Certification artifact checksum is not configured. ' +
        'Set CERT_BRUNO_SRC_CHECKSUM to the expected SHA-256 hex of the ZIP.';
      if (this.onDownloadError !== 'warning') {
        throw new Error(msg);
      }
      this.logger.warn(msg);
    }
  }

  async ensureRuntimeReady(): Promise<void> {
    if (this.isRuntimeReady && fs.existsSync(path.join(this.runtimeRoot, 'node_modules'))) {
      // Bruno already initialized and node_modules exists, so assume it's ready to go.
      this.logger.log(`Bruno runtime already initialized, skipping download.`);
      return;
    }

    const persistedRef = this.readPersistedRef();
    const nodeModulesDir = path.join(this.runtimeRoot, 'node_modules');

    if (persistedRef && persistedRef === this.targetDownloadRef && fs.existsSync(nodeModulesDir)) {
      // The persisted ref matches the target download ref, and node_modules exists, so we can skip re-downloading and re-installing.
      this.logger.log(`Bruno runtime up-to-date (ref: ${persistedRef}), skipping download.`);
      this.isRuntimeReady = true;
      return;
    }

    await this.ensureRuntime();
  }

  // ------------------------------------------------------------------------------
  // Private helper methods for managing the Bruno runtime and scenario executions.
  // ------------------------------------------------------------------------------

  private async ensureRuntime(): Promise<void> {
    this.logger.log(
      `Downloading Bruno artifact (ref: ${this.targetDownloadRef ?? 'unset'}) to ${this.runtimeRoot}`
    );

    const zipBuffer = await this.downloadArtifact();
    if (!zipBuffer) {
      // warning mode: downloadArtifact already logged the issue
      return;
    }

    this.extractArtifact(zipBuffer);
    this.installRuntimeDependencies();
    this.ensureEnvironmentFile();
    this.writePersistedRef();
    this.isRuntimeReady = true;
    this.logger.log('Bruno runtime ready');
  }

  private ensureEnvironmentFile(): void {
    const sisDir = path.join(this.runtimeRoot, this.collectionRootName);
    const envsDir = path.join(sisDir, 'environments');
    const bruFile = path.join(envsDir, `${this.brunoEnv}.bru`);

    fs.mkdirSync(envsDir, { recursive: true });
    fs.writeFileSync(
      bruFile,
      'vars {\n' +
      '  baseUrl: https://localhost/v7-multi-api/tenant1\n' +
      '  resourceBaseUrl: {{baseUrl}}/data/v3\n' +
      '  oauthUrl: {{baseUrl}}/oauth/token\n' +
      '  edFiClientId: <replace_with_edfiClientId_parameter>\n' +
      '  edFiClientSecret: <replace_with_edfiClientSecret_parameter>\n' +
      '}\n',
      'utf8'
    );
    this.logger.log(`Created environment placeholders: ${bruFile}`);
  }

  private installRuntimeDependencies() {
    const pkgJson = path.join(this.runtimeRoot, 'package.json');
    if (!fs.existsSync(pkgJson)) {
      this.logger.log('No package.json in Bruno runtime; skipping npm install');
      return;
    }

    const nodeModulesDir = path.join(this.runtimeRoot, 'node_modules');
    if (fs.existsSync(nodeModulesDir)) {
      return;
    }

    const hasLockFile = fs.existsSync(path.join(this.runtimeRoot, 'package-lock.json'));
    const npmCmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';

    const buildInstallArgs = (verb: 'ci' | 'install') =>
      process.platform === 'win32'
        ? ['/d', '/s', '/c', `npm ${verb} --no-audit --no-fund --ignore-scripts`]
        : [verb, '--no-audit', '--no-fund', '--ignore-scripts'];

    const runInstall = (verb: 'ci' | 'install') =>
      spawnSync(npmCmd, buildInstallArgs(verb), {
        cwd: this.runtimeRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10 * 60 * 1000,
      });

    this.logger.log('Installing Bruno runtime dependencies...');
    let result = runInstall(hasLockFile ? 'ci' : 'install');

    if (hasLockFile && result && result.status !== 0) {
      this.logger.warn('Bruno runtime npm ci failed; retrying with npm install');
      result = runInstall('install');
    }

    if (result?.error) {
      this.logger.warn(`Bruno runtime npm install process error: ${result.error.message}`);
      throw new Error('Bruno runtime dependencies could not be installed');
    }

    if (!result || result.status !== 0) {
      this.logger.warn(`Bruno runtime npm install failed: ${result && result.stderr}`);
      if (result && result.stdout) {
        this.logger.debug(`Bruno runtime npm install stdout: ${result.stdout}`);
      }
      throw new Error('Bruno runtime dependencies could not be installed');
    }

    this.logger.log('Bruno runtime dependencies installed');
  }

  private handleDownloadError(message: string): void {
    if (this.onDownloadError === 'warning') {
      this.logger.warn(message);
      return;
    }
    this.logger.error(message);
    throw new Error(message);
  }

  private async downloadArtifact(): Promise<Buffer | null> {
    if (!this.targetDownloadRef) {
      this.handleDownloadError('Cannot download artifact: no valid source ref is configured.');
      return null;
    }

    if (!this.expectedChecksum) {
      this.handleDownloadError('Cannot download artifact: no checksum configured.');
      return null;
    }

    const metadataUrl = `${this.BASE_URL}/${this.targetDownloadRef}/sis-${this.targetDownloadRef}.metadata.json`;

    this.logger.log(`Fetching artifact metadata from: ${metadataUrl}`);
    let metadata: { zipFileName: string; sha256: string };
    try {
      const metaRes = await fetch(metadataUrl);
      if (!metaRes.ok) {
        this.handleDownloadError(
          `Failed to fetch artifact metadata (HTTP ${metaRes.status}): ${metadataUrl}`
        );
        return null;
      }
      metadata = (await metaRes.json()) as { zipFileName: string; sha256: string };
    } catch (err) {
      this.handleDownloadError(`Failed to fetch artifact metadata: ${err}`);
      return null;
    }

    const zipUrl = `${this.BASE_URL}/${this.targetDownloadRef}/${metadata.zipFileName}`;
    this.logger.log(`Downloading artifact ZIP from: ${zipUrl}`);
    let zipBuffer: Buffer;
    try {
      const zipRes = await fetch(zipUrl);
      if (!zipRes.ok) {
        this.handleDownloadError(
          `Failed to download artifact ZIP (HTTP ${zipRes.status}): ${zipUrl}`
        );
        return null;
      }
      zipBuffer = Buffer.from(await zipRes.arrayBuffer());
    } catch (err) {
      this.handleDownloadError(`Failed to download artifact ZIP: ${err}`);
      return null;
    }

    const actualHash = createHash('sha256').update(zipBuffer).digest('hex');

    if (actualHash !== metadata.sha256) {
      this.handleDownloadError(
        `Artifact checksum mismatch (vs metadata.sha256)!\n  expected: ${metadata.sha256}\n  actual:   ${actualHash}`
      );
      return null;
    }

    if (actualHash !== this.expectedChecksum) {
      this.handleDownloadError(
        `Artifact checksum mismatch (vs CERT_BRUNO_SRC_CHECKSUM)!\n  expected: ${this.expectedChecksum}\n  actual:   ${actualHash}`
      );
      return null;
    }

    this.logger.log('Artifact checksum verified ✓');
    return zipBuffer;
  }

  private extractArtifact(zipBuffer: Buffer): void {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cert-artifact-'));

    try {
      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(tmpDir, /* overwrite */ true);

      // The ZIP contains a top-level bruno/ directory — locate it
      const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
      const brunoEntry = entries.find(
        (e) => e.isDirectory() && e.name.toLowerCase() === 'bruno'
      );
      if (!brunoEntry) {
        throw new Error(
          `Expected a 'bruno/' directory inside the artifact ZIP, but none was found. ` +
          `Contents: ${entries.map((e) => e.name).join(', ')}`
        );
      }

      const extractedBrunoDir = path.join(tmpDir, brunoEntry.name);

      // Remove stale runtime before moving in the fresh copy
      if (fs.existsSync(this.runtimeRoot)) {
        fs.rmSync(this.runtimeRoot, { recursive: true, force: true });
      }
      fs.mkdirSync(path.dirname(this.runtimeRoot), { recursive: true });
      fs.renameSync(extractedBrunoDir, this.runtimeRoot);

      this.logger.log(`Artifact extracted to: ${this.runtimeRoot}`);
    } finally {
      // Clean up the temp directory (best-effort)
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {
        // ignore cleanup errors
      }
    }
  }

  private get refFilePath(): string {
    return path.join(this.runtimeRoot, '.ref');
  }

  private readPersistedRef(): string | undefined {
    try {
      if (fs.existsSync(this.refFilePath)) {
        return fs.readFileSync(this.refFilePath, 'utf8').trim();
      }
    } catch (_) {
      // ignore — treat as missing
    }
    return undefined;
  }

  private writePersistedRef(): void {
    try {
      fs.writeFileSync(this.refFilePath, this.targetDownloadRef ?? '', 'utf8');
    } catch (err) {
      this.logger.warn(`Failed to write .ref file: ${err}`);
    }
  }


  
  // ------------------------------------------------------------------------------
  // @TODO: The underlying methods were copied from the original POC and will be refactored in Certification 2.2
  // ------------------------------------------------------------------------------

  // Run Bruno against a folder. Returns raw stdout and exit code
  async runBruno(folder: string, env?: string): Promise<{ exitCode: number; output: string }> {
    env = env || this.brunoEnv;

    // Run from the Bruno collection root whenever available.
    const collectionRoot = path.join(this.runtimeRoot, this.collectionRootName);
    const cwd = fs.existsSync(path.join(collectionRoot, 'bruno.json')) ? collectionRoot : this.runtimeRoot;
    let target = folder;
    try {
      const absoluteFolder = path.isAbsolute(folder) ? folder : path.resolve(cwd, folder);
      const relativeTarget = path.relative(cwd, absoluteFolder);
      if (!relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget)) {
        target = relativeTarget || '.';
      }
    } catch (_) {
      // ignore
    }

    const runtimeBin = path.join(this.runtimeRoot, 'node_modules', '.bin');
    const localBru = path.join(runtimeBin, process.platform === 'win32' ? 'bru.cmd' : 'bru');
    const hasLocalBru = fs.existsSync(localBru);
    const cmd = hasLocalBru ? `${localBru} run "${target}" --env ${env}` : `bru run "${target}" --env ${env}`;
    const fallback = `npx -p @usebruno/cli bru run "${target}" --env ${env}`;
    this.logger.log(`Running: ${cmd} (cwd: ${cwd})`);

    // Persist the exact command and cwd for debugging
    try {
      const cmdFile = path.join(this.runtimeRoot, 'last-command.txt');
      fs.writeFileSync(cmdFile, `cmd: ${cmd}\ncwd: ${cwd}\nfallback: ${fallback}\n`, 'utf8');
    } catch (err) {
      this.logger.debug(`Failed to write last-command.txt: ${err}`);
    }

    const spawnEnv = {
      ...process.env,
      PATH: [runtimeBin, process.env.PATH].filter(Boolean).join(path.delimiter),
    };
    let proc = hasLocalBru
      ? spawnSync(localBru, ['run', target, '--env', env], {
        shell: process.platform === 'win32',
        encoding: 'utf8',
        stdio: 'pipe',
        cwd,
        timeout: 10 * 60 * 1000,
        env: spawnEnv,
      })
      : spawnSync(fallback, { shell: true, encoding: 'utf8', stdio: 'pipe', cwd, timeout: 10 * 60 * 1000, env: spawnEnv });

    if (hasLocalBru && proc?.error) {
      this.logger.log(`Local Bruno CLI failed to execute (${proc.error.message}). Trying fallback.`);
      proc = spawnSync(fallback, { shell: true, encoding: 'utf8', stdio: 'pipe', cwd, timeout: 10 * 60 * 1000, env: spawnEnv });
    }

    const output = (proc && proc.stdout ? proc.stdout : '') + '\n' + (proc && proc.stderr ? proc.stderr : '');
    this.logger.log(`Bruno exit code: ${proc && proc.status}`);
    // Write last-output.txt for debugging
    try {
      const outFile = path.join(this.runtimeRoot, 'last-output.txt');
      fs.writeFileSync(outFile, `cmd: ${cmd}\ncwd: ${cwd}\n\nOUTPUT:\n${output}`, 'utf8');
    } catch (err) {
      this.logger.debug(`Failed to write last-output.txt: ${err}`);
    }

    return { exitCode: (proc && typeof proc.status === 'number') ? proc.status : 1, output };
  }

  // Prepare a working copy of a scenario and apply placeholder replacements
  async prepareScenario(scenarioPath: string, params: Record<string, any> = {}): Promise<string> {
    const scenarioSrc = path.join(this.runtimeRoot, this.collectionRootName, scenarioPath);
    if (!fs.existsSync(scenarioSrc)) {
      throw new Error(`Scenario source not found: ${scenarioSrc}`);
    }

    const workDir = path.join(this.runtimeRoot, this.collectionRootName, 'work', `${Date.now()}`);
    this.copyDirRecursive(scenarioSrc, workDir);

    // Replace placeholders in .bru and .json files
    this.replacePlaceholdersInDir(workDir, params);

    // If test-config.json exists, attempt to rewrite meta.seq based on order
    const configPath = path.join(workDir, 'test-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as any;
        if (Array.isArray(cfg.order) && cfg.order.length) {
          this.rewriteMetaSeqForOrder(workDir, cfg.order);
        }
      } catch (err) {
        this.logger.warn(`Failed to parse test-config.json: ${err}`);
      }
    }

    return workDir;
  }

  private replacePlaceholdersInDir(dir: string, params: Record<string, any>) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.replacePlaceholdersInDir(p, params);
        continue;
      }
      if (!/\.bru$|\.json$/i.test(entry.name)) continue;
      let content = fs.readFileSync(p, 'utf8');
      for (const [k, v] of Object.entries(params)) {
        const val = typeof v === 'string' ? v : JSON.stringify(v);
        const normKey = k
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[^A-Za-z0-9_]/g, '_')
          .toUpperCase();

        // 1) URL query param occurrences: e.g. schoolId=[...]
        const urlRe = new RegExp(`(${this.escapeRegExp(k)}=)([^&\\s\\)\"]*)`, 'gi');
        content = content.replace(urlRe, `$1${val}`);

        // 2) Params object lines: match only standalone param definitions like "schoolId: ..."
        //    Avoid matching property paths (e.g. `res.body[0].schoolId:`) by requiring
        //    the param name to be at start of line or preceded by whitespace/{/(, characters.
        const propRe = new RegExp(`(^|[\\s{(,])(${this.escapeRegExp(k)})\\s*:\\s*\\[?[^,\\n\\r}]*`, 'gmi');
        content = content.replace(propRe, `$1$2: ${val}`);

        // 3) Any bracketed token that contains the normalized key, e.g. [ENTER_SCHOOL_ID]
        const bracketRe = new RegExp(`\\[[^\\]]*${this.escapeRegExp(normKey)}[^\\]]*\\]`, 'gi');
        content = content.replace(bracketRe, val);

        // 4) Simple [KEY] pattern
        const simpleBr = new RegExp(`\\[${this.escapeRegExp(normKey)}\\]`, 'gi');
        content = content.replace(simpleBr, val);

      }
      fs.writeFileSync(p, content, 'utf8');
    }
  }

  private rewriteMetaSeqForOrder(workDir: string, order: string[]) {
    // Map filenames to sequence index
    const fileToSeq = new Map<string, number>();
    order.forEach((rel, idx) => {
      const base = path.basename(rel);
      fileToSeq.set(base, idx + 1);
    });

    const entries = fs.readdirSync(workDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.bru$/i.test(entry.name)) {
        const full = path.join(workDir, entry.name);
        let content = fs.readFileSync(full, 'utf8');
        const seq = fileToSeq.get(entry.name);
        if (seq !== undefined) {
          // Try to replace common patterns: "meta":{"seq":<num>} or meta.seq = <num>
          content = content.replace(/("meta"\s*:\s*\{[^}]*"seq"\s*:\s*)\d+/i, `$1${seq}`);
          content = content.replace(/(meta\.seq\s*=\s*)\d+/i, `$1${seq}`);
          fs.writeFileSync(full, content, 'utf8');
        }
      }
    }
  }

  private copyDirRecursive(src: string, dest: string) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
