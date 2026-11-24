import fs from 'fs';
import * as path from 'path';

/** Every non-spec TypeScript file under the certification module, nested folders included. */
const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });

/**
 * A run's history is written by the certification module itself, in the transaction of each
 * status change, so it is recorded even with audit logging turned off.
 */
describe('the certification module never uses the audit module', () => {
  const files = sourceFiles(__dirname);

  it('finds the module sources', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => path.basename(file))).toContain('certification.service.ts');
  });

  it.each(files.map((file) => [path.relative(__dirname, file), file]))(
    '%s neither imports the audit module nor reads AUDIT_ENABLED',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf-8');
      expect(source).not.toMatch(/from '(\.\.\/)+audit/);
      expect(source).not.toContain('AUDIT_ENABLED');
    },
  );
});
