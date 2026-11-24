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

const WRITE_METHODS = 'update|delete|remove|softDelete|softRemove|save|upsert';

/** A run's history entries are only ever inserted; the run's cascade is all that removes them. */
describe('nothing updates or deletes a history entry', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const files = sourceFiles(srcRoot).filter((file) =>
    fs.readFileSync(file, 'utf-8').includes('CertificationRunEvent'),
  );

  it('finds the files that use the entity', () => {
    expect(files.map((file) => path.basename(file))).toContain('certification-runs.service.ts');
  });

  it.each(files.map((file) => [path.relative(srcRoot, file), file]))(
    '%s never writes to an entry other than inserting',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf-8');

      // em.getRepository(CertificationRunEvent).delete(...), dataSource.getRepository(...) etc.
      expect(source).not.toMatch(
        new RegExp(
          String.raw`getRepository\(\s*CertificationRunEvent\s*\)\s*\.(${WRITE_METHODS})\(`,
        ),
      );
      // em.update(CertificationRunEvent, ...), em.delete(CertificationRunEvent, ...) etc.
      expect(source).not.toMatch(
        new RegExp(String.raw`\.(${WRITE_METHODS})\(\s*CertificationRunEvent\b`),
      );
      // createQueryBuilder().delete().from(CertificationRunEvent)
      expect(source).not.toMatch(/\.from\(\s*CertificationRunEvent\b/);

      // Any injected or declared Repository<CertificationRunEvent>, whatever it is called.
      const names = [...source.matchAll(/(\w+)\s*:\s*Repository<CertificationRunEvent>/g)].map(
        (match) => match[1],
      );
      for (const name of names) {
        expect(source).not.toMatch(new RegExp(String.raw`${name}\s*\.(${WRITE_METHODS})\(`));
      }
    },
  );
});
