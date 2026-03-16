import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);
  // Default source path: workspace root / certification-testing / bruno
  private readonly srcPath: string;
  // Runtime root inside API package
  private readonly runtimeRoot: string;
  private readonly collectionRootName = 'SIS';
  private readonly brunoEnv: string;
  private runtimeInitialized = false;

  constructor() {
    this.runtimeRoot = process.env.CERT_BRUNO_RUNTIME || path.resolve(process.cwd(), 'packages', 'api', 'runtime', 'bruno');
    // Determine source path from environment or common sibling locations
    const envSrc = process.env.CERT_BRUNO_SRC_PATH;
    const candidates = [] as string[];
    if (envSrc) candidates.push(envSrc);
    // common dev locations: inside workspace root, or sibling repo next to workspace
    candidates.push(path.resolve(process.cwd(), 'certification-testing', 'bruno'));
    candidates.push(path.resolve(process.cwd(), '..', 'certification-testing', 'bruno'));
    candidates.push(path.resolve(process.cwd(), '..', '..', 'certification-testing', 'bruno'));

    let found: string | undefined;
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) {
          found = c;
          break;
        }
      } catch (_) {
        // ignore
      }
    }
    const resolvedSrc = found || (envSrc || path.resolve(process.cwd(), 'certification-testing', 'bruno'));
    this.srcPath = this.resolveWorkspaceRoot(resolvedSrc);
    if (found) {
      this.logger.log(`Using Bruno source path: ${this.srcPath}`);
    } else {
      this.logger.warn(`Bruno source path not found in candidates; falling back to ${this.srcPath}`);
    }
    this.brunoEnv = process.env.CERT_BRUNO_ENV || 'ci.ed-fi.org';
  }

  async ensureRuntime(): Promise<void> {
    this.logger.log(`Refreshing runtime at ${this.runtimeRoot} from ${this.srcPath}`);

    // If source doesn't exist, create an empty runtime folder and exit
    if (!fs.existsSync(this.srcPath)) {
      this.logger.warn(`Source path for Bruno collections not found: ${this.srcPath}`);
      try {
        fs.mkdirSync(this.runtimeRoot, { recursive: true });
      } catch (err) {
        this.logger.error(`Failed to ensure empty runtime folder: ${err}`);
        throw err;
      }
      return;
    }

    // Remove existing runtime (if any) so we always have a fresh copy
    try {
      if (fs.existsSync(this.runtimeRoot)) {
        fs.rmSync(this.runtimeRoot, { recursive: true, force: true });
      }
    } catch (err) {
      this.logger.warn(`Failed to remove existing runtime folder, continuing: ${err}`);
    }

    try {
      this.copyDirRecursive(this.srcPath, this.runtimeRoot);
      this.installRuntimeDependencies();
      this.runtimeInitialized = true;
      this.logger.log('Bruno runtime refreshed');
    } catch (err) {
      this.logger.error(`Failed to populate runtime: ${err}`);
      throw err;
    }
  }

  async ensureRuntimeReady(): Promise<void> {
    if (this.runtimeInitialized && fs.existsSync(path.join(this.runtimeRoot, 'node_modules'))) {
      return;
    }

    const workspacePkg = path.join(this.runtimeRoot, 'package.json');
    const collectionDir = path.join(this.runtimeRoot, this.collectionRootName);
    const nodeModulesDir = path.join(this.runtimeRoot, 'node_modules');

    if (!fs.existsSync(workspacePkg) || !fs.existsSync(collectionDir)) {
      await this.ensureRuntime();
      return;
    }

    if (!fs.existsSync(nodeModulesDir)) {
      this.installRuntimeDependencies();
    }

    this.runtimeInitialized = true;
  }

  private resolveWorkspaceRoot(srcPath: string): string {
    const base = path.basename(srcPath).toLowerCase();
    if (base === this.collectionRootName.toLowerCase()) {
      const parent = path.dirname(srcPath);
      const parentPkg = path.join(parent, 'package.json');
      if (fs.existsSync(parentPkg)) {
        this.logger.log(`Bruno source path points to collection; using parent workspace: ${parent}`);
        return parent;
      }
    }

    return srcPath;
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

  // Prepare a working copy of a scenario and apply placeholder replacements
  async prepareScenario(scenarioPath: string, params: Record<string, any> = {}): Promise<string> {
    const scenarioSrc = path.join(this.runtimeRoot, this.collectionRootName, scenarioPath);
    if (!fs.existsSync(scenarioSrc)) {
      throw new Error(`Scenario source not found: ${scenarioSrc}`);
    }

    const workDir = path.join(this.runtimeRoot, this.collectionRootName, 'work', `${Date.now()}`);
    this.copyDirRecursive(scenarioSrc, workDir);

    // Copy collection-level metadata (collection.bru, bruno.json, environments/, .env, etc.)
    //this.copyCollectionMetadataIntoWork(workDir);

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

  private escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

//   private copyCollectionMetadataIntoWork(workDir: string) {
//     const itemsToCopy = [
//       'bruno.json',
//       'collection.bru',
//       '.env',
//       '.env.example',
//       'environments',
//       'logging.js',
//       'utils.js',
//       'package.json',
//       'README.md',
//     ];

//     for (const item of itemsToCopy) {
//       const src = path.join(this.runtimeRoot, item);
//       const dest = path.join(workDir, item);
//       try {
//         if (!fs.existsSync(src)) continue;
//         const stat = fs.statSync(src);
//         if (stat.isDirectory()) {
//           this.copyDirRecursive(src, dest);
//         } else if (stat.isFile()) {
//           // ensure dest directory exists
//           fs.mkdirSync(path.dirname(dest), { recursive: true });
//           fs.copyFileSync(src, dest);
//         }
//       } catch (err) {
//         this.logger.warn(`Failed to copy collection item ${item}: ${err}`);
//       }
//     }
//   }

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
}
