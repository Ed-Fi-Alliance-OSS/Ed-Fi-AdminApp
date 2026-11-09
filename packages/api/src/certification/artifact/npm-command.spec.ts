import * as path from 'path';
import { resolveNpmCommand } from './npm-command';

describe('resolveNpmCommand', () => {
  const nodeBinDir = path.join(path.sep, 'opt', 'node', 'bin');
  const execPath = path.join(nodeBinDir, 'node');
  const unixCli = path.join(nodeBinDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const winCli = path.join(nodeBinDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');

  it('runs npm-cli.js through node when found next to the node binary (Windows layout)', () => {
    const result = resolveNpmCommand({
      execPath,
      platform: 'win32',
      exists: (file) => file === winCli,
    });
    expect(result).toEqual({ command: execPath, prefixArgs: [winCli] });
  });

  it('runs npm-cli.js through node when found in ../lib (Linux / Docker layout)', () => {
    const result = resolveNpmCommand({
      execPath,
      platform: 'linux',
      exists: (file) => file === unixCli,
    });
    expect(result).toEqual({ command: execPath, prefixArgs: [unixCli] });
  });

  it('falls back to the npm executable on non-Windows platforms', () => {
    const result = resolveNpmCommand({ execPath, platform: 'linux', exists: () => false });
    expect(result).toEqual({ command: 'npm', prefixArgs: [] });
  });

  it('fails on Windows when npm-cli.js is missing, never falling back to a shell', () => {
    expect(() => resolveNpmCommand({ execPath, platform: 'win32', exists: () => false })).toThrow(
      'npm-cli.js'
    );
  });
});
