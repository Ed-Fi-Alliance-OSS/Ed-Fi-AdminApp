import * as fs from 'fs';
import * as path from 'path';

export interface NpmCommand {
  command: string;
  /** Arguments that must precede the npm arguments (the npm-cli.js path when run through node). */
  prefixArgs: string[];
}

export interface ResolveNpmCommandOptions {
  execPath?: string;
  platform?: NodeJS.Platform;
  exists?: (file: string) => boolean;
}

/**
 * Builds the command that runs npm without a shell. npm ships as npm-cli.js next to the node
 * binary (`<node dir>/node_modules/npm` on Windows, `<node dir>/../lib/node_modules/npm` on
 * Linux/macOS/Docker), so running it through node works everywhere. Windows has no other option:
 * `npm.cmd` can't be spawned with shell: false, and a shell is what we are avoiding.
 *
 * If `npm-cli.js` is not found: on Linux/macOS this falls back to plain `npm` resolved from PATH;
 * on Windows it throws.
 */
export const resolveNpmCommand = ({
  execPath = process.execPath,
  platform = process.platform,
  exists = fs.existsSync,
}: ResolveNpmCommandOptions = {}): NpmCommand => {
  const nodeDir = path.dirname(execPath);
  // Intended: the npm bundled with node wins over a newer globally installed npm. Using the
  // global one on Windows would require npm.cmd, which cannot be spawned without a shell.
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const cli = candidates.find((candidate) => exists(candidate));
  if (cli) return { command: execPath, prefixArgs: [cli] };
  if (platform !== 'win32') return { command: 'npm', prefixArgs: [] };
  throw new Error(`npm-cli.js not found next to ${execPath}; cannot run npm without a shell`);
};
