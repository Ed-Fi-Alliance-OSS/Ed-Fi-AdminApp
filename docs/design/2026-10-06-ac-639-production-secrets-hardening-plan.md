# AC-639 Production Secrets Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop shipping credential-bearing defaults in the production image, and make the API refuse to start in production when a secret is missing, blank, a placeholder or a known sample value.

**Architecture:** `production.js-edfi` keeps only non-secret settings. A new pure validator (`assertProductionSecrets`) runs at the very top of `bootstrap()` in `main.ts`, before any database connection or migration, and throws one error naming every bad variable. `compose/.env.example` ships `change-me-...` placeholders; the e2e runner generates real values through a new, separately testable PowerShell helper.

**Tech Stack:** NestJS, node-config v5 (`custom-environment-variables.js`), Jest + ts-jest, PowerShell 7, Docker Compose.

**Spec:** `docs/design/2026-10-06-ac-639-production-secrets-hardening.md` (read it first; this plan amends it in Task 7).

## Global Constraints

- Stacked on PR 404: the branch must be rebased onto `origin/AC-637` before any code change (Task 0). PR 404 is open, so do not duplicate what it already added (`assertValidDbEncryptionSecret`, `assertValidSessionSecret`, `__name`/`__format` mapping for `DB_ENCRYPTION_SECRET_VALUE` and `SESSION_SECRET_VALUE`, session-secret patching in `run-e2e-ui.ps1`).
- `production.js-edfi` keeps its name; the Dockerfile `COPY` line is not changed.
- config v5 needs `{ __name, __format: 'json' }` in `custom-environment-variables.js`; plain `{ name, format }` is not the supported form.
- The validator is gated on `process.env.NODE_ENV === 'production'` (the production build swaps `modes/dev.ts` for `modes/prod.ts`, which sets it). No "allow insecure" flag.
- Rejected values: empty/blank, `<set-me>`, anything starting with `change-me` (case-insensitive), `postgres`, `YourStrong!Passw0rd`, `big-secret-123`, plus the sample encryption keys.
- Obey `.editorconfig`: UTF-8, 2-space indentation, final newline, trailing whitespace trimmed, LF line endings.
- Commit messages are semantic (`fix:`, `docs:`, ...) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never use `--no-verify`; the husky hook runs `eslint --max-warnings 0` on staged files.
- Before the final commit: `npm run build` and `npm run lint:check` must pass (AGENTS.md).
- PowerShell here is `pwsh` (PowerShell 7). Run Jest as `npx jest --config packages/api/jest.config.ts <path>`; `npm run test:api` has about 50 pre-existing failing suites (per PR 404), so only run targeted specs and compare against the baseline recorded in Task 0.

## Review Focus

1. **Placeholder seeded into the DB before validation runs.** `migrationsRun: true` runs the seeding migration during `NestFactory.create`. If the validator ran after it, a placeholder OIDC secret would already be in the `oidc` table, and the "only seed when the table is empty" check would skip the real secret on the next start. Pinned by Task 2 (call site before `checkDatabaseAvailability`) and the migration guard.
2. **`SAMPLE_OIDC_CONFIG` present but without a `clientSecret`.** The stripped template still has `issuer`/`clientId`. The API must start, skip seeding and log the existing "No OIDC config found" warning, not insert the string `'undefined'` and not fail startup. Pinned by Task 1 (validator skips when undefined) and Task 2 (migration guard).
3. **DB secret sourced from AWS Secrets Manager while `production.js` still defines non-secret `DB_SECRET_VALUE` fields.** The validator must not complain about a "missing" password it never looks at. Pinned by Task 1 (`dbSecret: undefined` skip) and Task 2 (`config.AWS_DB_SECRET` branch).
4. **Wrong engine's password.** With `DB_ENGINE=mssql` a bad `DB_PASSWORD` is irrelevant and a bad `MSSQL_DB_PASSWORD` fails (and vice versa). Pinned by Task 1.
5. **The e2e runner leaving stale defaults behind.** `bootstrap-keycloak-for-tests.ps1` falls back to `YourStrong!Passw0rd` when `MSSQL_SA_PASSWORD` is unset in the process environment; with a generated password this breaks the mssql leg silently. Pinned by Task 5 (runner exports the generated password, bootstrap script throws instead of falling back).

---

### Task 0: Rebase onto PR 404, install dependencies, record baseline, probe config mapping

**Files:**
- No source changes. Scratch files only, in the session scratchpad directory.

**Interfaces:**
- Produces: a clean branch based on `origin/AC-637`; installed `node_modules`; the probe result that decides Task 3 Step 3.

- [ ] **Step 1: Rebase onto AC-637**

Run:
```bash
git fetch origin AC-637
git rebase origin/AC-637
git log --oneline -5
```
Expected: the spec commit `docs: add AC-639 production secrets hardening design` sits on top of AC-637's history. If the spec/plan files conflict (they should not), keep both.

- [ ] **Step 2: Install dependencies**

Run: `npm ci --legacy-peer-deps --no-audit --no-fund`
Expected: exits 0. `node_modules/config/package.json` exists.

- [ ] **Step 3: Record the Jest baseline for the files this plan touches**

Run:
```bash
npx jest --config packages/api/jest.config.ts packages/api/src/app/db-encryption-secret.spec.ts packages/api/src/app/session-secret.spec.ts packages/api/src/utils/checkEnv.spec.ts packages/api/config
```
Expected: PASS. Write down any failure; those are pre-existing and not caused by this work.

- [ ] **Step 4: Probe whether config v5 honors `{ name, format }` for `DB_SECRET_VALUE`**

Run (from the repo root; `packages/api/config/production.js` is a tracked stub without `DB_SECRET_VALUE`, so any value that appears came from the environment):
```bash
NODE_ENV=production NODE_CONFIG_DIR=packages/api/config DB_SECRET_VALUE='{"DB_PASSWORD":"probe-pw"}' \
  node -e "const c=require('config'); console.log(JSON.stringify(c.DB_SECRET_VALUE))"
```
Expected, one of:
- `{"DB_PASSWORD":"probe-pw"}`: the plain `{ name, format }` form works; record "no change needed for DB_SECRET_VALUE" for Task 3.
- anything else (`undefined`, `{"name":"{...}"}`): the plain form is ignored; Task 3 Step 3 must switch `DB_SECRET_VALUE` to `__name`/`__format`.

Record the exact output in the Task 3 commit message body.

No commit in this task.

---

### Task 1: Production secrets validator (TDD)

**Files:**
- Create: `packages/api/src/app/production-secrets.ts`
- Create: `packages/api/src/app/production-secrets.spec.ts`
- Modify: `packages/api/src/app/db-encryption-secret.ts` (export `KNOWN_SAMPLE_KEYS`, add the `.env.example` key)
- Modify: `packages/api/src/app/db-encryption-secret.spec.ts`

**Interfaces:**
- Produces (used by Tasks 2 and 3):
  - `export const KNOWN_SAMPLE_SECRETS: readonly string[]` in `production-secrets.ts`
  - `export interface ProductionSecretsInput { nodeEnv: string | undefined; dbEngine: 'pgsql' | 'mssql'; dbSecret?: { DB_PASSWORD?: unknown; MSSQL_DB_PASSWORD?: unknown }; sampleOidcClientSecret?: unknown }`
  - `export function assertProductionSecrets(input: ProductionSecretsInput): void`
  - `export const KNOWN_SAMPLE_KEYS: readonly string[]` in `db-encryption-secret.ts`

- [ ] **Step 1: Write the failing validator spec**

Create `packages/api/src/app/production-secrets.spec.ts`:

```ts
import { assertProductionSecrets, KNOWN_SAMPLE_SECRETS, ProductionSecretsInput } from './production-secrets';

const valid: ProductionSecretsInput = {
  nodeEnv: 'production',
  dbEngine: 'pgsql',
  dbSecret: { DB_PASSWORD: 'a-real-strong-password' },
  sampleOidcClientSecret: 'a-real-client-secret',
};

describe('assertProductionSecrets', () => {
  it('accepts real values in production', () => {
    expect(() => assertProductionSecrets(valid)).not.toThrow();
  });

  it.each(['development', 'testing', undefined])('does nothing when NODE_ENV is %s', (nodeEnv) => {
    expect(() =>
      assertProductionSecrets({ nodeEnv, dbEngine: 'pgsql', dbSecret: { DB_PASSWORD: 'postgres' } })
    ).not.toThrow();
  });

  it.each(KNOWN_SAMPLE_SECRETS)('rejects the known sample DB password %s', (sample) => {
    expect(() => assertProductionSecrets({ ...valid, dbSecret: { DB_PASSWORD: sample } })).toThrow(
      /DB_SECRET_VALUE\.DB_PASSWORD/
    );
  });

  it.each(['', '   ', undefined, null, 42])('rejects a missing or blank DB password (%p)', (value) => {
    expect(() => assertProductionSecrets({ ...valid, dbSecret: { DB_PASSWORD: value } })).toThrow(
      /DB_SECRET_VALUE\.DB_PASSWORD is missing or blank/
    );
  });

  it.each(['<set-me>', 'change-me', 'CHANGE-ME-set-a-strong-password', 'change-me-generate-with-openssl-rand'])(
    'rejects the placeholder %s',
    (placeholder) => {
      expect(() => assertProductionSecrets({ ...valid, dbSecret: { DB_PASSWORD: placeholder } })).toThrow(
        /placeholder or known sample value/
      );
    }
  );

  it('checks MSSQL_DB_PASSWORD, not DB_PASSWORD, when the engine is mssql', () => {
    expect(() =>
      assertProductionSecrets({
        ...valid,
        dbEngine: 'mssql',
        dbSecret: { DB_PASSWORD: 'postgres', MSSQL_DB_PASSWORD: 'a-real-strong-password' },
      })
    ).not.toThrow();
    expect(() =>
      assertProductionSecrets({
        ...valid,
        dbEngine: 'mssql',
        dbSecret: { DB_PASSWORD: 'a-real-strong-password', MSSQL_DB_PASSWORD: 'YourStrong!Passw0rd' },
      })
    ).toThrow(/DB_SECRET_VALUE\.MSSQL_DB_PASSWORD/);
  });

  it('checks DB_PASSWORD, not MSSQL_DB_PASSWORD, when the engine is pgsql', () => {
    expect(() =>
      assertProductionSecrets({
        ...valid,
        dbSecret: { DB_PASSWORD: 'a-real-strong-password', MSSQL_DB_PASSWORD: 'YourStrong!Passw0rd' },
      })
    ).not.toThrow();
  });

  it('does not inspect the DB password when the DB secret comes from AWS Secrets Manager', () => {
    expect(() => assertProductionSecrets({ ...valid, dbSecret: undefined })).not.toThrow();
  });

  it('skips the OIDC check when no sample client secret is configured', () => {
    expect(() => assertProductionSecrets({ ...valid, sampleOidcClientSecret: undefined })).not.toThrow();
  });

  it.each(['big-secret-123', '', '  ', 'change-me-generate-with-openssl-rand', '<set-me>'])(
    'rejects the sample OIDC client secret %p when one is configured',
    (secret) => {
      expect(() => assertProductionSecrets({ ...valid, sampleOidcClientSecret: secret })).toThrow(
        /SAMPLE_OIDC_CONFIG\.clientSecret/
      );
    }
  );

  it('reports every problem in one error', () => {
    let message = '';
    try {
      assertProductionSecrets({
        nodeEnv: 'production',
        dbEngine: 'pgsql',
        dbSecret: { DB_PASSWORD: 'postgres' },
        sampleOidcClientSecret: 'big-secret-123',
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('DB_SECRET_VALUE.DB_PASSWORD');
    expect(message).toContain('SAMPLE_OIDC_CONFIG.clientSecret');
    expect(message).toContain('environment variable or AWS Secrets Manager');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --config packages/api/jest.config.ts packages/api/src/app/production-secrets.spec.ts`
Expected: FAIL, `Cannot find module './production-secrets'`.

- [ ] **Step 3: Implement the validator**

Create `packages/api/src/app/production-secrets.ts`:

```ts
// Values committed or documented in this repo as samples. They are publicly known and are never
// valid in a real production deployment.
export const KNOWN_SAMPLE_SECRETS: readonly string[] = ['postgres', 'YourStrong!Passw0rd', 'big-secret-123'];

const PLACEHOLDER_PATTERN = /^(<set-me>|change-me)/i;

export interface ProductionSecretsInput {
  nodeEnv: string | undefined;
  dbEngine: 'pgsql' | 'mssql';
  /**
   * Locally configured DB secret. Pass `undefined` when the DB secret comes from AWS Secrets
   * Manager: those values are operator-managed and are not inspected here.
   */
  dbSecret?: { DB_PASSWORD?: unknown; MSSQL_DB_PASSWORD?: unknown };
  /**
   * Only checked when provided. Without a client secret the first-run OIDC seeding is skipped,
   * so there is nothing to validate.
   */
  sampleOidcClientSecret?: unknown;
}

function describeProblem(name: string, value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `${name} is missing or blank`;
  }
  if (PLACEHOLDER_PATTERN.test(value) || KNOWN_SAMPLE_SECRETS.includes(value)) {
    return `${name} is still a placeholder or known sample value`;
  }
  return undefined;
}

/**
 * Throws, listing every offending variable, when a production deployment would start with a
 * missing, placeholder or publicly known secret. Does nothing outside NODE_ENV=production so
 * local development with sample values keeps working. The encryption key is validated
 * separately by assertValidDbEncryptionSecret.
 */
export function assertProductionSecrets(input: ProductionSecretsInput): void {
  if (input.nodeEnv !== 'production') {
    return;
  }

  const problems: string[] = [];

  if (input.dbSecret) {
    const field = input.dbEngine === 'mssql' ? 'MSSQL_DB_PASSWORD' : 'DB_PASSWORD';
    const problem = describeProblem(`DB_SECRET_VALUE.${field}`, input.dbSecret[field]);
    if (problem) {
      problems.push(problem);
    }
  }

  if (input.sampleOidcClientSecret !== undefined) {
    const problem = describeProblem('SAMPLE_OIDC_CONFIG.clientSecret', input.sampleOidcClientSecret);
    if (problem) {
      problems.push(problem);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start: insecure production configuration.\n${problems
        .map((p) => `  - ${p}. Set a real value via environment variable or AWS Secrets Manager.`)
        .join('\n')}`
    );
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest --config packages/api/jest.config.ts packages/api/src/app/production-secrets.spec.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Reject the `.env.example` encryption key too (failing test first)**

Append to the `describe` block in `packages/api/src/app/db-encryption-secret.spec.ts` (before its final `});`):

```ts
  it('throws when KEY still equals the key that used to ship in compose/.env.example', () => {
    expect(() =>
      assertValidDbEncryptionSecret({
        KEY: '4bb5c8ddaee19b8734675193868cd83511b04ee29ed7cc9aebc0dff5b3079dda',
        IV: 'unused',
      })
    ).toThrow('DB_ENCRYPTION_SECRET.KEY must be configured to a value other than the committed sample key');
  });
```

Run: `npx jest --config packages/api/jest.config.ts packages/api/src/app/db-encryption-secret.spec.ts`
Expected: FAIL on the new test (the key is accepted today).

Then in `packages/api/src/app/db-encryption-secret.ts` change the constant and export it:

```ts
export const KNOWN_SAMPLE_KEYS: readonly string[] = [
  'bbeadc2d4d15f5c9cfc2239b682cca392b233ee6979b6b9578d256aa01a7c565',
  'ef9c1dcd53175358daefcce54891e1779f9837d5ff25c74a674de3d1a749d81f',
  '4bb5c8ddaee19b8734675193868cd83511b04ee29ed7cc9aebc0dff5b3079dda',
];
```
(Keep the existing comment above it; add `compose/.env.example` to the list of places the comment names.)

Run the same spec again. Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint --max-warnings 0 packages/api/src/app/production-secrets.ts packages/api/src/app/production-secrets.spec.ts packages/api/src/app/db-encryption-secret.ts packages/api/src/app/db-encryption-secret.spec.ts
git add packages/api/src/app/production-secrets.ts packages/api/src/app/production-secrets.spec.ts packages/api/src/app/db-encryption-secret.ts packages/api/src/app/db-encryption-secret.spec.ts
git commit -m "$(cat <<'EOF'
feat: add production secrets validator

Fail startup in production when the DB password or the seeded OIDC client
secret is missing, blank, a placeholder or a known sample value. Also reject
the encryption key that used to ship in compose/.env.example.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: the husky hook passes and the commit is created.

---

### Task 2: Wire the validator in before any DB work, and make OIDC seeding conditional

**Files:**
- Modify: `packages/api/src/main.ts` (import near the PR 404 imports `session-secret` / `db-encryption-secret`; call right after `Logger.overrideLogger(getLogLevel());` in `bootstrap()`)
- Modify: `packages/api/typings/config.d.ts` and `types/config-shim.d.ts` (type `DB_SECRET_VALUE`)
- Modify: `packages/api/src/database/migrations/pgsql/1697203599392-Seeding.ts` (line 68)
- Modify: `packages/api/src/database/migrations/mssql/1697203599392-Seeding.ts` (line 69)

**Interfaces:**
- Consumes: `assertProductionSecrets`, `ProductionSecretsInput` from Task 1.
- Produces: the validator runs once per process start, before `checkDatabaseAvailability()` and before `NestFactory.create` (which runs migrations).

- [ ] **Step 1: Type `DB_SECRET_VALUE` in both typing files**

In both `packages/api/typings/config.d.ts` and `types/config-shim.d.ts`, replace the line `    DB_SECRET_VALUE: never;` with:

```ts
    /** Locally configured DB connection settings. Undefined when the DB secret comes from AWS Secrets Manager. */
    DB_SECRET_VALUE?: {
      DB_PASSWORD?: string;
      MSSQL_DB_PASSWORD?: string;
      [key: string]: unknown;
    };
```

Run: `npx tsc -p packages/api/tsconfig.app.json --noEmit`
Expected: exits 0. If `never` was relied on anywhere, the compiler names the file; fix that usage (the earlier search found only `checkEnv.ts`'s `=== undefined` comparison, which still compiles).

- [ ] **Step 2: Add the call in `bootstrap()`**

In `packages/api/src/main.ts`, add next to the other `./app/...` imports:

```ts
import { assertProductionSecrets } from './app/production-secrets';
```

and in `bootstrap()`, directly after `Logger.overrideLogger(getLogLevel());`:

```ts
  // Validate production secrets before ANY database work. Creating the app runs migrations, and
  // the seeding migration would otherwise insert a placeholder OIDC client secret into the oidc
  // table before we got a chance to refuse -- and since seeding only runs while that table is
  // empty, the real secret would never be seeded after the operator fixed their configuration.
  assertProductionSecrets({
    nodeEnv: process.env.NODE_ENV,
    dbEngine: config.DB_ENGINE || 'pgsql',
    // AWS-managed DB secrets are operator-controlled and not inspected here.
    dbSecret: config.AWS_DB_SECRET ? undefined : config.DB_SECRET_VALUE,
    sampleOidcClientSecret: config.SAMPLE_OIDC_CONFIG?.clientSecret,
  });
```

- [ ] **Step 3: Make seeding conditional on a configured client secret**

In `packages/api/src/database/migrations/pgsql/1697203599392-Seeding.ts` and `.../mssql/1697203599392-Seeding.ts`, change:

```ts
      if (config.SAMPLE_OIDC_CONFIG) {
```
to:
```ts
      if (config.SAMPLE_OIDC_CONFIG?.clientSecret) {
```
Nothing else changes: the existing `else` branch already logs "No OIDC config found, skipping seeding of OIDC...". Because the stripped `production.js` still defines `issuer`/`clientId`, without this guard a deployment that supplies no secret would insert the literal string `undefined` as the client secret.

Run: `grep -n "SAMPLE_OIDC_CONFIG" packages/api/src/database/migrations/*/1697203599392-Seeding.ts`
Expected: both files show the `?.clientSecret` form on the `if` line.

- [ ] **Step 4: Type-check and run the related specs**

```bash
npx tsc -p packages/api/tsconfig.app.json --noEmit
npx jest --config packages/api/jest.config.ts packages/api/src/app packages/api/src/utils/checkEnv.spec.ts
```
Expected: tsc exits 0; Jest shows no new failures versus the Task 0 baseline.

- [ ] **Step 5: Lint and commit**

```bash
git add packages/api/src/main.ts packages/api/typings/config.d.ts types/config-shim.d.ts packages/api/src/database/migrations/pgsql/1697203599392-Seeding.ts packages/api/src/database/migrations/mssql/1697203599392-Seeding.ts
git commit -m "$(cat <<'EOF'
feat: validate production secrets before any database work

Run assertProductionSecrets at the top of bootstrap, before migrations can
seed a placeholder OIDC secret. Seed the sample OIDC connection only when a
client secret is configured.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: the hook passes.

---

### Task 3: Strip secrets from the production template, fix the config mappings, add the guard spec

**Files:**
- Modify: `packages/api/config/production.js-edfi`
- Modify: `packages/api/config/custom-environment-variables.js`
- Modify: `packages/api/config/custom-environment-variables.spec.ts` (added by PR 404)
- Create: `packages/api/src/app/production-secrets-guard.spec.ts`

**Interfaces:**
- Consumes: `KNOWN_SAMPLE_SECRETS` (Task 1, `production-secrets.ts`) and `KNOWN_SAMPLE_KEYS` (Task 1, `db-encryption-secret.ts`).
- Produces: a template with no secret values; JSON-mapped `SAMPLE_OIDC_CONFIG` and `AUTH0_CONFIG_SECRET_VALUE` (plus `DB_SECRET_VALUE` if the Task 0 probe said so).

- [ ] **Step 1: Write the failing guard spec**

Create `packages/api/src/app/production-secrets-guard.spec.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { KNOWN_SAMPLE_KEYS } from './db-encryption-secret';
import { KNOWN_SAMPLE_SECRETS } from './production-secrets';

const repoRoot = path.resolve(__dirname, '../../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const publicSecrets = [...KNOWN_SAMPLE_KEYS, ...KNOWN_SAMPLE_SECRETS];

describe('committed files carry no usable secrets', () => {
  it('packages/api/config/production.js-edfi contains no known sample secret', () => {
    const template = read('packages/api/config/production.js-edfi');
    for (const secret of publicSecrets) {
      expect(template).not.toContain(secret);
    }
  });

  it('packages/api/config/production.js-edfi no longer defines an encryption key block', () => {
    expect(read('packages/api/config/production.js-edfi')).not.toContain('DB_ENCRYPTION_SECRET_VALUE');
  });

  it('compose/.env.example contains no known sample secret', () => {
    const example = read('compose/.env.example');
    for (const secret of publicSecrets) {
      expect(example).not.toContain(secret);
    }
  });

  it('compose/.env.example secrets are change-me placeholders', () => {
    const example = read('compose/.env.example');
    expect(example).toMatch(/^POSTGRES_PASSWORD=change-me/m);
    expect(example).toMatch(/^KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=change-me/m);
    expect(example).toMatch(/^KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=change-me/m);
    expect(example).toMatch(/^DB_ENCRYPTION_SECRET_VALUE=\{"KEY":"change-me/m);
    expect(example).toMatch(/^DB_SECRET_VALUE=\{"DB_HOST".*"DB_PASSWORD":"change-me/m);
    expect(example).toMatch(/^# DB_SECRET_VALUE=\{"MSSQL_DB_HOST".*"MSSQL_DB_PASSWORD":"change-me/m);
  });

  it('the Dockerfile copies only the sanitized template as production.js', () => {
    const copies = read('packages/api/Dockerfile')
      .split('\n')
      .filter((line) => /^COPY\b/.test(line) && line.includes('packages/api/config/'));
    const productionCopies = copies.filter((line) => /production\.js/.test(line));
    expect(productionCopies).toHaveLength(1);
    expect(productionCopies[0]).toContain('packages/api/config/production.js-edfi ./dist/packages/api/config/production.js');
    expect(copies.some((line) => /local\.js/.test(line))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --config packages/api/jest.config.ts packages/api/src/app/production-secrets-guard.spec.ts`
Expected: FAIL (the template and `.env.example` still contain the sample secrets). The Dockerfile test already passes; that is fine, it pins the invariant.

- [ ] **Step 3: Strip `production.js-edfi`**

In `packages/api/config/production.js-edfi`:

1. Directly under line 1 (`// packages/api/config/local-development.js - Nginx proxy version`) add:

```js
// This file is copied into the Docker image as production.js (packages/api/Dockerfile).
// It must NEVER contain secret values. Supply every secret through environment variables
// or AWS Secrets Manager; the API refuses to start in production when one is missing or
// still a placeholder (see packages/api/src/app/production-secrets.ts).
//   DB_SECRET_VALUE            JSON, e.g. {"DB_PASSWORD":"..."} / {"MSSQL_DB_PASSWORD":"..."}
//   DB_ENCRYPTION_SECRET_VALUE JSON, {"KEY":"<64 hex chars: openssl rand -hex 32>","IV":"unused"}
//   SESSION_SECRET_VALUE       JSON array of secrets, newest first
//   SAMPLE_OIDC_CONFIG         JSON, {"clientSecret":"..."} (optional: seeds the first IdP row)
```

2. Delete the line `    DB_PASSWORD: 'postgres',` and the line `    MSSQL_DB_PASSWORD: 'YourStrong!Passw0rd',` from `DB_SECRET_VALUE`.
3. Delete the whole `DB_ENCRYPTION_SECRET_VALUE: { ... },` block (the `KEY` and `IV` lines and their comment).
4. Delete the line `    clientSecret: 'big-secret-123',` from `SAMPLE_OIDC_CONFIG`.
5. Delete the line `    CLIENT_SECRET: 'big-secret-123',` from `AUTH0_CONFIG_SECRET_VALUE` (the app never reads it).
6. Keep PR 404's comment about `SESSION_SECRET_VALUE`.

- [ ] **Step 4: Fix the config mappings**

In `packages/api/config/custom-environment-variables.js` replace:

```js
  SAMPLE_OIDC_CONFIG: 'SAMPLE_OIDC_CONFIG',
  AUTH0_CONFIG_SECRET_VALUE: 'AUTH0_CONFIG_SECRET_VALUE',
```
with:
```js
  SAMPLE_OIDC_CONFIG: { __name: 'SAMPLE_OIDC_CONFIG', __format: 'json' },
  AUTH0_CONFIG_SECRET_VALUE: { __name: 'AUTH0_CONFIG_SECRET_VALUE', __format: 'json' },
```
and, only if the Task 0 probe showed the plain form is ignored, replace
`DB_SECRET_VALUE: { name: 'DB_SECRET_VALUE', format: 'json' },` with
`DB_SECRET_VALUE: { __name: 'DB_SECRET_VALUE', __format: 'json' },`.
If the probe showed it works, leave that line alone and mention the probe result in the commit body.

Append to `packages/api/config/custom-environment-variables.spec.ts`, inside the existing `describe`, matching the style of the PR 404 tests (add the `DB_SECRET_VALUE` case only if you changed it):

```ts
  it('maps SAMPLE_OIDC_CONFIG and AUTH0_CONFIG_SECRET_VALUE as JSON objects so partial overrides merge', () => {
    expect(customEnvironmentVariables.SAMPLE_OIDC_CONFIG).toEqual({
      __name: 'SAMPLE_OIDC_CONFIG',
      __format: 'json',
    });
    expect(customEnvironmentVariables.AUTH0_CONFIG_SECRET_VALUE).toEqual({
      __name: 'AUTH0_CONFIG_SECRET_VALUE',
      __format: 'json',
    });
  });
```

- [ ] **Step 5: Verify the merge behavior with the real config library**

Run:
```bash
NODE_ENV=production NODE_CONFIG_DIR=packages/api/config SAMPLE_OIDC_CONFIG='{"clientSecret":"merged"}' \
  node -e "console.log(JSON.stringify(require('config').SAMPLE_OIDC_CONFIG))"
```
This runs against the stub `production.js`, so it only proves JSON parsing. For the merge with the real template, use a scratch config dir in the session scratchpad: copy `default.js`, `custom-environment-variables.js` and `production.js-edfi` (renamed `production.js`) there, then run the same command with `NODE_CONFIG_DIR` pointing at it.
Expected: the output contains `"clientSecret":"merged"` together with `"issuer":"https://localhost/auth/realms/edfi"`, `"clientId":"edfiadminapp"` and `"scope":""`.

- [ ] **Step 6: The guard spec still fails on `.env.example`; that is Task 4. Run the rest**

Run: `npx jest --config packages/api/jest.config.ts packages/api/config packages/api/src/app/production-secrets-guard.spec.ts`
Expected: the config specs PASS; in the guard spec the two `production.js-edfi` tests and the Dockerfile test PASS; the two `.env.example` tests still FAIL (fixed in Task 4).

- [ ] **Step 7: Commit**

```bash
npx eslint --max-warnings 0 packages/api/src/app/production-secrets-guard.spec.ts packages/api/config/custom-environment-variables.spec.ts
git add packages/api/config/production.js-edfi packages/api/config/custom-environment-variables.js packages/api/config/custom-environment-variables.spec.ts packages/api/src/app/production-secrets-guard.spec.ts
git commit -m "$(cat <<'EOF'
fix: remove baked-in secrets from the production image config

production.js-edfi is copied into the image as production.js and shipped a
public AES key, the Keycloak sample client secret and the DB passwords. It now
holds non-secret settings only. Map SAMPLE_OIDC_CONFIG and
AUTH0_CONFIG_SECRET_VALUE as JSON so partial env overrides merge over the
file.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: the hook passes. (The two `.env.example` guard tests fail until Task 4; do not push between Tasks 3 and 4.)

---

### Task 4: `.env.example` placeholders and compose wiring

**Files:**
- Modify: `compose/.env.example`
- Modify: `compose/adminapp-services.yml` (API `environment:` list, after the `SESSION_SECRET_VALUE` line)

**Interfaces:**
- Consumes: the guard spec from Task 3 (it defines the exact line shapes).
- Produces: placeholders the Task 5 PowerShell helper patches by regex; the exact line shapes below are a contract with that helper.

- [ ] **Step 1: Edit `compose/.env.example`**

Make exactly these replacements (the values after `=`):

| Line starts with | New line |
|---|---|
| `POSTGRES_PASSWORD=` | `POSTGRES_PASSWORD=change-me-set-a-strong-password` |
| `KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=` | `KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=change-me-generate-with-openssl-rand` |
| `KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=` | `KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=change-me-generate-with-openssl-rand` |
| `DB_ENCRYPTION_SECRET_VALUE=` | `DB_ENCRYPTION_SECRET_VALUE={"KEY":"change-me-generate-with-openssl-rand-hex-32","IV":"unused"}` |
| `DB_SECRET_VALUE={"DB_HOST"` | `DB_SECRET_VALUE={"DB_HOST":"edfiadminapp-postgres","DB_PORT":5432,"DB_USERNAME":"postgres","DB_PASSWORD":"change-me-set-a-strong-password","DB_DATABASE":"sbaa"}` |
| `# DB_SECRET_VALUE={"MSSQL_DB_HOST"` | `# DB_SECRET_VALUE={"MSSQL_DB_HOST":"edfiadminapp-mssql","MSSQL_DB_PORT":1433,"MSSQL_DB_USERNAME":"sa","MSSQL_DB_PASSWORD":"change-me-set-a-strong-password","MSSQL_DB_DATABASE":"sbaa"}` |

Leave `# MSSQL_SA_PASSWORD=` blank (it is already "required, no default" and the runner patches it).

Update the surrounding comments:
- Above the Keycloak secrets: replace "Local-development values - change on a shared host." with "Placeholders: replace before starting the stack (the API refuses to start in production with a placeholder). `eng/testing/run-e2e-ui.ps1` generates real values for e2e runs."
- Above `POSTGRES_PASSWORD`: add one line "# Placeholder: set a strong password. Must match DB_PASSWORD in the pgsql DB_SECRET_VALUE below."
- Replace the `DB_ENCRYPTION_SECRET_VALUE` comment block with:
  ```
  ## DB_ENCRYPTION_SECRET_VALUE - JSON object holding the AES-256 key used to
  ## encrypt sb_environment.configPrivate (stored Admin API client secrets).
  ## The placeholder below makes the API refuse to start. Generate a real key with
  ## `openssl rand -hex 32` and keep it secret: anyone with it and a database dump
  ## can decrypt every stored downstream credential.
  ```
- In the `DB_SECRET_VALUE` comment block, change "Keep DB_USERNAME / DB_PASSWORD / DB_DATABASE in sync with ..." so it also says the password placeholder must be replaced and kept equal to `POSTGRES_PASSWORD` (pgsql) or `MSSQL_SA_PASSWORD` (mssql).
- In the existing warning above the MSSQL lines (the one about `Set-AdminAppEnvFile` regex patching), add `POSTGRES_PASSWORD`, `KEYCLOAK_EDFIADMINAPP_*_CLIENT_SECRET`, `DB_ENCRYPTION_SECRET_VALUE` and both `DB_SECRET_VALUE` lines to the list of lines the runner rewrites.

- [ ] **Step 2: Pass the OIDC client secret to the API**

In `compose/adminapp-services.yml`, in the `edfiadminapp-api` `environment:` list directly after `- SESSION_SECRET_VALUE=${SESSION_SECRET_VALUE}` add:

```yaml
      - 'SAMPLE_OIDC_CONFIG={"clientSecret":"${KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET}"}'
```
It deep-merges over `issuer`, `clientId` and `scope` from `production.js`, so the seeded IdP row matches the Keycloak client. If the variable is unset it becomes `""`, which the validator rejects as blank.

- [ ] **Step 3: Verify**

```bash
npx jest --config packages/api/jest.config.ts packages/api/src/app/production-secrets-guard.spec.ts
docker compose --env-file compose/.env.example -f compose/edfi-services.yml -f compose/nginx-compose.yml -f compose/adminapp-services.yml --profile adminapp --profile postgresql config > /dev/null
```
Expected: all guard tests PASS; `docker compose config` exits 0. If Docker is not available, skip the second command and say so in the commit/PR notes (do not claim it passed).

- [ ] **Step 4: Commit**

```bash
git add compose/.env.example compose/adminapp-services.yml
git commit -m "$(cat <<'EOF'
fix: ship change-me placeholders in compose/.env.example

Copying the example unchanged now produces a stack whose API refuses to start
instead of one running on publicly known secrets. Pass the Keycloak client
secret to the API so the seeded IdP row matches.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: e2e runner secret generation, start-script warnings, bootstrap fallback

**Files:**
- Create: `eng/helpers/env-secrets.ps1`
- Create: `eng/testing/test-env-secrets.ps1`
- Create: `eng/helpers/warn-env-placeholders.ps1`
- Modify: `eng/testing/run-e2e-ui.ps1` (`Set-AdminAppEnvFile`, plus a dot-source near the top-level helper calls)
- Modify: `eng/helpers/bootstrap-keycloak-for-tests.ps1` (lines 94 and 126)
- Modify: `eng/helpers/start-services-target.ps1` (after `$env:DB_ENGINE = $expectedEngine`)
- Modify: `compose/start-services.ps1` (after the `if (Test-Path $EnvFile) { ... }` block, before `if ($Rebuild)`)

**Interfaces:**
- Consumes: the exact `.env.example` line shapes from Task 4.
- Produces:
  - `New-RandomSecret [-Length <int> = 32]`: alphanumeric string containing at least one upper-case letter, one lower-case letter and one digit (meets SQL Server's 3-of-4 complexity rule, safe in JSON, URLs and regex replacements).
  - `New-RandomHex [-Bytes <int> = 32]`: lower-case hex string, `2 * Bytes` characters.
  - `Set-GeneratedEnvSecrets -EnvPath <string>`: rewrites the placeholder lines in a `.env`, each rule must match exactly once or it throws; returns nothing.
  - `warn-env-placeholders.ps1 -EnvFile <string>`: prints one `Write-Warning` listing uncommented variables that still contain `change-me`.

- [ ] **Step 1: Write the failing smoke test**

Create `eng/testing/test-env-secrets.ps1`:

```powershell
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
  Smoke test for eng/helpers/env-secrets.ps1. Needs no Docker. Run: pwsh ./eng/testing/test-env-secrets.ps1
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
. (Join-Path $repoRoot 'eng/helpers/env-secrets.ps1')

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "FAILED: $Message" }
}

function Get-EnvValue {
  param([string[]]$Lines, [string]$Name)
  ($Lines | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1) -replace "^$Name=", ''
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempDir | Out-Null
try {
  # --- generators ---
  for ($i = 0; $i -lt 50; $i++) {
    $secret = New-RandomSecret
    Assert-True ($secret -cmatch '^[A-Za-z0-9]{32}$') "New-RandomSecret produced '$secret'"
    Assert-True ($secret -cmatch '[A-Z]' -and $secret -cmatch '[a-z]' -and $secret -match '[0-9]') "New-RandomSecret lacks a character class: '$secret'"
  }
  Assert-True ((New-RandomHex) -match '^[0-9a-f]{64}$') 'New-RandomHex is not 64 lowercase hex chars'
  Assert-True ((New-RandomSecret) -ne (New-RandomSecret)) 'New-RandomSecret returned the same value twice'

  # --- patching a copy of the real example ---
  $envPath = Join-Path $tempDir '.env'
  Copy-Item (Join-Path $repoRoot 'compose/.env.example') $envPath
  Set-GeneratedEnvSecrets -EnvPath $envPath
  $lines = Get-Content $envPath

  $uncommentedPlaceholders = $lines | Where-Object { $_ -match '^\s*[A-Z0-9_]+\s*=.*change-me' }
  Assert-True (-not $uncommentedPlaceholders) "Placeholders remain: $($uncommentedPlaceholders -join ' | ')"

  $postgresPassword = Get-EnvValue $lines 'POSTGRES_PASSWORD'
  Assert-True ($postgresPassword -cmatch '^[A-Za-z0-9]{32}$') 'POSTGRES_PASSWORD was not generated'
  $dbSecret = Get-EnvValue $lines 'DB_SECRET_VALUE'
  Assert-True ($dbSecret.Contains("`"DB_PASSWORD`":`"$postgresPassword`"")) 'pgsql DB_SECRET_VALUE password does not match POSTGRES_PASSWORD'
  Assert-True ((Get-EnvValue $lines 'DB_ENCRYPTION_SECRET_VALUE') -match '^\{"KEY":"[0-9a-f]{64}","IV":"unused"\}$') 'DB_ENCRYPTION_SECRET_VALUE key is not 64 hex chars'
  $clientSecret = Get-EnvValue $lines 'KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET'
  $devClientSecret = Get-EnvValue $lines 'KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET'
  Assert-True ($clientSecret -cmatch '^[A-Za-z0-9]{32}$' -and $devClientSecret -cmatch '^[A-Za-z0-9]{32}$') 'Keycloak client secrets were not generated'
  Assert-True ($clientSecret -ne $devClientSecret) 'Keycloak client secrets must differ'
  Assert-True ($lines -contains '# MSSQL_SA_PASSWORD=') 'MSSQL_SA_PASSWORD line must be left for the mssql branch'

  # --- a reformatted example must fail loudly, not silently skip ---
  $broken = Join-Path $tempDir '.env.broken'
  Get-Content (Join-Path $repoRoot 'compose/.env.example') | Where-Object { $_ -notmatch '^POSTGRES_PASSWORD=' } | Set-Content $broken
  $threw = $false
  try { Set-GeneratedEnvSecrets -EnvPath $broken } catch { $threw = $true; $message = $_.Exception.Message }
  Assert-True $threw 'Set-GeneratedEnvSecrets did not throw when POSTGRES_PASSWORD was missing'
  Assert-True ($message -match 'POSTGRES_PASSWORD') "Error does not name the missing rule: $message"

  # --- the warning script flags placeholders ---
  $warnings = & (Join-Path $repoRoot 'eng/helpers/warn-env-placeholders.ps1') -EnvFile (Join-Path $repoRoot 'compose/.env.example') 3>&1
  Assert-True ($warnings -match 'POSTGRES_PASSWORD' -and $warnings -match 'DB_ENCRYPTION_SECRET_VALUE') 'warn-env-placeholders did not list the example placeholders'
  $clean = & (Join-Path $repoRoot 'eng/helpers/warn-env-placeholders.ps1') -EnvFile $envPath 3>&1
  Assert-True (-not $clean) 'warn-env-placeholders warned on a fully generated .env'

  Write-Host 'env-secrets smoke test passed.' -ForegroundColor Green
}
finally {
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pwsh ./eng/testing/test-env-secrets.ps1`
Expected: FAIL, cannot find `eng/helpers/env-secrets.ps1`.

- [ ] **Step 3: Implement the helper**

Create `eng/helpers/env-secrets.ps1`:

```powershell
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# Secret generation for automated provisioning of compose/.env. Dot-source this file.
# Tested by eng/testing/test-env-secrets.ps1.

function New-RandomHex {
  param([int]$Bytes = 32)
  -join ([System.Security.Cryptography.RandomNumberGenerator]::GetBytes($Bytes) | ForEach-Object { $_.ToString('x2') })
}

# Alphanumeric only, so the value is safe inside JSON, URLs and regex replacement strings.
# Always contains an upper-case letter, a lower-case letter and a digit, which satisfies
# SQL Server's "3 of 4 character categories" password rule.
function New-RandomSecret {
  param([int]$Length = 32)
  $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  do {
    $secret = -join (1..$Length | ForEach-Object {
      $alphabet[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32($alphabet.Length)]
    })
  } until ($secret -cmatch '[A-Z]' -and $secret -cmatch '[a-z]' -and $secret -match '[0-9]')
  $secret
}

# Replaces the change-me placeholders that compose/.env.example ships with generated values.
# Each rule must match exactly once: a reformatted or duplicated example line must fail loudly
# rather than leave a placeholder (or a half-patched pair) behind. The mssql-specific lines
# (MSSQL_SA_PASSWORD and the commented mssql DB_SECRET_VALUE) are patched by
# Set-AdminAppEnvFile in eng/testing/run-e2e-ui.ps1.
function Set-GeneratedEnvSecrets {
  param([Parameter(Mandatory = $true)][string]$EnvPath)

  $dbPassword = New-RandomSecret
  $clientSecret = New-RandomSecret
  $devClientSecret = New-RandomSecret
  $encryptionKey = New-RandomHex

  $fired = [ordered]@{
    'POSTGRES_PASSWORD'                       = 0
    'KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET'     = 0
    'KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET' = 0
    'DB_ENCRYPTION_SECRET_VALUE'              = 0
    'DB_SECRET_VALUE (PostgreSQL)'            = 0
  }

  $content = Get-Content -Path $EnvPath | ForEach-Object {
    switch -Regex ($_) {
      '^POSTGRES_PASSWORD=change-me.*$' { $fired['POSTGRES_PASSWORD']++; "POSTGRES_PASSWORD=$dbPassword" }
      '^KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=change-me.*$' { $fired['KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET']++; "KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET=$clientSecret" }
      '^KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=change-me.*$' { $fired['KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET']++; "KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET=$devClientSecret" }
      '^DB_ENCRYPTION_SECRET_VALUE=\{"KEY":"change-me[^"]*".*$' {
        $fired['DB_ENCRYPTION_SECRET_VALUE']++
        $_ -replace '"KEY":"[^"]*"', "`"KEY`":`"$encryptionKey`""
      }
      '^DB_SECRET_VALUE=\{"DB_HOST".*"DB_PASSWORD":"change-me[^"]*".*$' {
        $fired['DB_SECRET_VALUE (PostgreSQL)']++
        $_ -replace '"DB_PASSWORD":"[^"]*"', "`"DB_PASSWORD`":`"$dbPassword`""
      }
      default { $_ }
    }
  }

  $wrong = $fired.GetEnumerator() | Where-Object { $_.Value -ne 1 }
  if ($wrong) {
    $detail = ($wrong | ForEach-Object { "'$($_.Key)' matched $($_.Value) time(s), expected 1" }) -join '; '
    throw "compose/.env.example did not match the expected secret placeholder patterns: $detail. It may have been reformatted or a key duplicated; update the patterns in Set-GeneratedEnvSecrets (eng/helpers/env-secrets.ps1)."
  }

  Set-Content -Path $EnvPath -Value $content
}
```

- [ ] **Step 4: Implement the warning script**

Create `eng/helpers/warn-env-placeholders.ps1`:

```powershell
# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
  Warns when an env file still contains the change-me placeholders from compose/.env.example.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$EnvFile
)

if (-not (Test-Path $EnvFile)) {
  return
}

# Only uncommented lines: the pattern requires the line to start with the variable name.
$stale = @(Select-String -Path $EnvFile -Pattern '^\s*([A-Z0-9_]+)\s*=.*change-me' |
  ForEach-Object { $_.Matches[0].Groups[1].Value } |
  Sort-Object -Unique)

if ($stale.Count -gt 0) {
  Write-Warning "$EnvFile still contains placeholder (change-me) values for: $($stale -join ', '). The Admin App API refuses to start in production with placeholder secrets. Set real values, or generate them with eng/testing/run-e2e-ui.ps1."
}
```

- [ ] **Step 5: Run the smoke test to verify it passes**

Run: `pwsh ./eng/testing/test-env-secrets.ps1`
Expected: `env-secrets smoke test passed.` and exit code 0.

- [ ] **Step 6: Integrate into `run-e2e-ui.ps1`**

In `eng/testing/run-e2e-ui.ps1`:

1. Directly above `function Set-AdminAppEnvFile {`, add:

```powershell
. (Join-Path $repoRoot 'eng/helpers/env-secrets.ps1')
```

2. In `Set-AdminAppEnvFile`, immediately after the line `Write-Host "compose/.env patched with a generated SESSION_SECRET_VALUE." -ForegroundColor Cyan` add:

```powershell
  # compose/.env.example ships change-me placeholders for every other secret too, for the same
  # reason: copying it unchanged must never yield a working stack on publicly known values.
  Set-GeneratedEnvSecrets -EnvPath $envPath
  Write-Host "compose/.env patched with generated database, encryption-key and Keycloak client secrets." -ForegroundColor Cyan
```

3. In the mssql block replace `$mssqlPassword = 'YourStrong!Passw0rd'` with:

```powershell
  $mssqlPassword = New-RandomSecret
  # Child scripts (eng/helpers/bootstrap-keycloak-for-tests.ps1) read the SA password from the
  # process environment.
  $env:MSSQL_SA_PASSWORD = $mssqlPassword
```
Keep the following `$script:mssqlSaPassword = $mssqlPassword` line and everything after it unchanged: the existing `-replace` already writes `$mssqlPassword` into the mssql `DB_SECRET_VALUE` line and `MSSQL_SA_PASSWORD`.

- [ ] **Step 7: Remove the hardcoded SA password fallback**

In `eng/helpers/bootstrap-keycloak-for-tests.ps1`, in both places (lines 94 and 126) replace

```powershell
$saPassword = if ($env:MSSQL_SA_PASSWORD) { $env:MSSQL_SA_PASSWORD } else { 'YourStrong!Passw0rd' }
```
with
```powershell
if (-not $env:MSSQL_SA_PASSWORD) { throw 'MSSQL_SA_PASSWORD is not set. Set it to the value in compose/.env (eng/testing/run-e2e-ui.ps1 exports it for you).' }
$saPassword = $env:MSSQL_SA_PASSWORD
```
The old default is a publicly known value and would not match a generated password anyway.

- [ ] **Step 8: Add the placeholder warnings to the start scripts**

In `eng/helpers/start-services-target.ps1`, directly after the line `$env:DB_ENGINE = $expectedEngine`:

```powershell
& (Join-Path $PSScriptRoot 'warn-env-placeholders.ps1') -EnvFile $envFile
```

In `compose/start-services.ps1`, after the closing brace of the `if (Test-Path $EnvFile) { ... }` block and before `if ($Rebuild) {`:

```powershell
& (Join-Path $PSScriptRoot '..\eng\helpers\warn-env-placeholders.ps1') -EnvFile $EnvFile
```

- [ ] **Step 9: Verify what can be verified without Docker**

```bash
pwsh ./eng/testing/test-env-secrets.ps1
pwsh -NoProfile -Command "foreach ($f in 'eng/testing/run-e2e-ui.ps1','eng/helpers/bootstrap-keycloak-for-tests.ps1','eng/helpers/start-services-target.ps1','compose/start-services.ps1','eng/helpers/env-secrets.ps1','eng/helpers/warn-env-placeholders.ps1') { $errs = $null; [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $f), [ref]$null, [ref]$errs); if ($errs) { throw \"$f : $($errs[0].Message)\" } }; 'parse ok'"
```
Expected: smoke test passes; `parse ok`. The mssql branch of `Set-AdminAppEnvFile` and the full stack are not exercised here; say so in the PR description.

- [ ] **Step 10: Commit**

```bash
git add eng/helpers/env-secrets.ps1 eng/helpers/warn-env-placeholders.ps1 eng/testing/test-env-secrets.ps1 eng/testing/run-e2e-ui.ps1 eng/helpers/bootstrap-keycloak-for-tests.ps1 eng/helpers/start-services-target.ps1 compose/start-services.ps1
git commit -m "$(cat <<'EOF'
fix: generate real secrets for e2e runs and warn about placeholders

The e2e runner replaces the change-me placeholders in compose/.env with
generated values, keeping the DB passwords consistent across POSTGRES_PASSWORD,
MSSQL_SA_PASSWORD and DB_SECRET_VALUE. The start scripts warn when
placeholders remain, and the Keycloak bootstrap helper no longer falls back to
a hardcoded SQL Server password.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Documentation and rotation guidance

**Files:**
- Create: `docs/secret-rotation.md`
- Modify: `compose/readme.md` (lines ~297 and ~305; the `AUTH0_CONFIG_SECRET_VALUE`/`CLIENT_SECRET` snippets near lines 578-590 and 679 are `local.js` dev examples and stay as they are)
- Modify: `docs/setup-private-server.md` (line 20 and the section "4. Configure the Application URLs")
- Modify: `eng/testing/README.md` (the "What It Does" step 3 and a short note about volumes)

**Interfaces:**
- Consumes: variable names and placeholders from Tasks 3-5.
- Produces: `docs/secret-rotation.md`, linked from the other two docs.

- [ ] **Step 1: Write `docs/secret-rotation.md`**

Content (adapt wording, keep every fact):

```markdown
# Secret Rotation

Images built before AC-639 shipped `packages/api/config/production.js-edfi` as `production.js`
with a publicly known `DB_ENCRYPTION_SECRET_VALUE.KEY`, the Keycloak sample client secret
(`big-secret-123`) and sample database passwords. If a deployment ever ran with those values,
treat them as compromised and rotate everything below.

## What each secret protects

| Secret | Where it is set | Protects |
|---|---|---|
| `DB_ENCRYPTION_SECRET_VALUE.KEY` | env var (JSON) or AWS Secrets Manager | `sb_environment.configPrivate`: stored Admin API client secrets (AES-256-CBC) |
| `DB_SECRET_VALUE` password | env var (JSON) or AWS Secrets Manager | Admin App database |
| `SAMPLE_OIDC_CONFIG.clientSecret` | env var (JSON) | OIDC client secret seeded on first run; also stored in the `oidc` table |
| `SESSION_SECRET_VALUE` | env var (JSON array) or AWS Secrets Manager | Session cookie signing |

## Procedure

1. Back up the Admin App database.
2. Generate a new key: `openssl rand -hex 32`.
3. Rotate the downstream Admin API client secrets that `configPrivate` held. They were readable by anyone with a dump and the old key, so changing the encryption key alone is not enough.
4. Re-encrypt `sb_environment.configPrivate` from the old key to the new key (script below), then deploy with the new `DB_ENCRYPTION_SECRET_VALUE`. Rows still encrypted with the old key cannot be read by the app.
5. Change the database password in the database server and in `DB_SECRET_VALUE`.
6. Change the OIDC client secret in the identity provider and in the `oidc` table (`clientSecret` column) or through the Admin App.
7. Replace the session secret(s): put the new one first and keep the old one second until existing sessions expire (see `SESSION_SECRET_VALUE` in `compose/.env.example`).

## Re-encrypting `configPrivate`

The app encrypts this column with `JSONEncryptionTransformer` from `typeorm-encrypted`
(`algorithm: 'aes-256-cbc'`, `ivLength: 16`; see `packages/models-server/src/entities/sb-environment.entity.ts`).
A one-off script must use exactly the same settings. PostgreSQL example (adapt the query for
SQL Server, where the column is stored as text JSON). Run it against a **copy** of the database first.

```js
// reencrypt.js - run from the repo root: OLD_KEY=... NEW_KEY=... DATABASE_URL=... node reencrypt.js
const { JSONEncryptionTransformer } = require('typeorm-encrypted');
const { Client } = require('pg');

const make = (key) => new JSONEncryptionTransformer({ key, algorithm: 'aes-256-cbc', ivLength: 16 });
const oldT = make(process.env.OLD_KEY);
const newT = make(process.env.NEW_KEY);

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query('SELECT id, "configPrivate" FROM sb_environment WHERE "configPrivate" IS NOT NULL');
  for (const row of rows) {
    const plain = oldT.from(row.configPrivate);
    await client.query('UPDATE sb_environment SET "configPrivate" = $1::jsonb WHERE id = $2', [
      JSON.stringify(newT.to(plain)),
      row.id,
    ]);
  }
  await client.end();
  console.log(`re-encrypted ${rows.length} row(s)`);
})();
```

Confirm the table and column names with `\d sb_environment` before running, and verify one
environment in the Admin App after the switch.
```

(When writing the file, use a four-backtick outer fence in your editor or indent the inner block so the nested fences render; the final file must contain the script as a normal fenced block.)

- [ ] **Step 2: Update `compose/readme.md`**

In the "To use SQL Server instead of PostgreSQL" list, replace the two literal `YourStrong!Passw0rd` occurrences (the `MSSQL_SA_PASSWORD=` example and the `DB_SECRET_VALUE` example) with `<your-strong-password>`, and add under it: "Use the same generated password for `MSSQL_SA_PASSWORD` and `MSSQL_DB_PASSWORD`." Add a short section "Secrets" near the top-level setup steps:

```markdown
### Secrets

`compose/.env.example` ships `change-me-...` placeholders for `POSTGRES_PASSWORD`,
`KEYCLOAK_EDFIADMINAPP_CLIENT_SECRET`, `KEYCLOAK_EDFIADMINAPP_DEV_CLIENT_SECRET`,
`DB_ENCRYPTION_SECRET_VALUE` and the password inside `DB_SECRET_VALUE`, and an empty
`SESSION_SECRET_VALUE`. The API refuses to start with any of them unchanged.
Replace them before running `docker compose up` (`openssl rand -hex 32` works for the
encryption key; use any strong password elsewhere), or run `eng/testing/run-e2e-ui.ps1`,
which generates them. If you change `POSTGRES_PASSWORD` after the database volume was first
created, reset the volume (`docker compose down -v`): PostgreSQL only reads the password on first
initialization. Deployments that ever ran an image built before AC-639 should follow
[secret rotation](../docs/secret-rotation.md).
```

- [ ] **Step 3: Update `docs/setup-private-server.md`**

- Line 20: replace the bullet with: "`production.js-edfi` no longer contains secrets. Set every secret in `compose/.env` (see the Secrets section of `compose/readme.md`) before starting; the API refuses to start with the `change-me` placeholders."
- In section "4. Configure the Application URLs": delete the sentence implying secrets live in the file, and add after the code block: "Secrets are not configured in this file. Set them in `compose/.env`."
- Link `docs/secret-rotation.md` from the Considerations list.

- [ ] **Step 4: Update `eng/testing/README.md`**

In "What It Does" step 3, extend the sentence: "...and generates real values for the `change-me` placeholders (session secret, database password, encryption key, Keycloak client secrets) so `compose/.env` is never run with publicly known secrets." Add one line to the troubleshooting area: "If you re-run against an existing PostgreSQL volume, the old password is still in the volume; use `-StopServices` and `docker compose down -v` first." Document `eng/testing/test-env-secrets.ps1` as the no-Docker smoke test for the generator.

- [ ] **Step 5: Commit**

```bash
git add docs/secret-rotation.md compose/readme.md docs/setup-private-server.md eng/testing/README.md
git commit -m "$(cat <<'EOF'
docs: document secret provisioning and rotation after AC-639

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Amend the spec, run the full verification, summarize

**Files:**
- Modify: `docs/design/2026-10-06-ac-639-production-secrets-hardening.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Bring the spec in line with what was built**

Edit the spec so it states the three decisions made while planning:
1. Section 3: the OIDC check applies when `SAMPLE_OIDC_CONFIG.clientSecret` is configured (not merely when `SAMPLE_OIDC_CONFIG` exists, which is always true because the template keeps `issuer`/`clientId`), and the seeding migrations seed only when a client secret is configured.
2. Section 3: the validator is called at the top of `bootstrap()`, before `checkDatabaseAvailability()` and `NestFactory.create`, because migrations (including seeding) run during app creation. Note that PR 404's two asserts run after app creation; moving them is out of scope.
3. Section 4/5: `MSSQL_SA_PASSWORD` stays blank in `.env.example` (already required, no default); the e2e runner exports the generated value as `$env:MSSQL_SA_PASSWORD` and `bootstrap-keycloak-for-tests.ps1` no longer falls back to the sample password.
Change the status line to `Status: implemented (see plan)`.

- [ ] **Step 2: Full verification (AGENTS.md requirements)**

```bash
npx jest --config packages/api/jest.config.ts packages/api/src/app packages/api/src/utils/checkEnv.spec.ts packages/api/config
pwsh ./eng/testing/test-env-secrets.ps1
npm run lint:check
npm run build
```
Expected: Jest passes with no failures beyond the Task 0 baseline; the smoke test passes; lint and build exit 0. If `npm run build` fails, read the error to decide whether it comes from this change or already exists on `origin/AC-637`. Fix the former; report the latter instead of hiding it.

- [ ] **Step 3: Production-image behavior check (only if Docker is available)**

```bash
docker build -f packages/api/Dockerfile -t adminapp-api:ac639 .
docker run --rm adminapp-api:ac639 node -e "const c=require('config'); console.log(Object.keys(c.DB_SECRET_VALUE), c.DB_ENCRYPTION_SECRET_VALUE)" 
```
Expected: no `DB_PASSWORD`/`MSSQL_DB_PASSWORD` key and `undefined` for `DB_ENCRYPTION_SECRET_VALUE` (use `NODE_ENV=production -e NODE_CONFIG_DIR=/app/dist/packages/api/config`). Then `docker run --rm -e NODE_ENV=production ... node dist/packages/api/main.js` with no secrets set should exit non-zero with a message naming the missing variables. If Docker is unavailable, state that this check was not run.

- [ ] **Step 4: Commit the spec amendment**

```bash
git add docs/design/2026-10-06-ac-639-production-secrets-hardening.md
git commit -m "$(cat <<'EOF'
docs: align AC-639 design with the implementation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Report**

Report to the user, in this order: what changed, what was verified (with the commands above), what was **not** verified (Playwright e2e, the mssql runner branch, `docker compose config` and image build if Docker was missing), and the remaining follow-ups (PR 404's own key/session asserts run after app creation; the test-only Keycloak machine-client default `edfi-machine-secret-456`; no re-encryption tool beyond the documented script).
