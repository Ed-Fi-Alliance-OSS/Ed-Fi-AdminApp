# No-comments Lint Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lint rejects every source comment except reasoned lint/TS directives; the ~6.8k existing violations are frozen via ESLint bulk suppressions.

**Architecture:** A local ESLint rule (`eslint-rules/no-comments.mjs`) walks `sourceCode.getAllComments()` and reports anything not on a directive allowlist. It is registered as an inline `local` plugin in `eslint.config.mjs`, together with directive-hygiene rules. Legacy violations go into a committed `eslint-suppressions.json` that can only shrink.

**Tech Stack:** ESLint 10.15 flat config, `@eslint-community/eslint-plugin-eslint-comments` 4.8.1 (supports ESLint 10), `node:test` + ESLint `RuleTester`, husky/lint-staged.

**Spec:** `docs/superpowers/specs/2026-11-24-no-comments-lint-design.md`

## Global Constraints

- ESLint 10.15 flat config in `eslint.config.mjs`; `reportUnusedDisableDirectives: 'error'`.
- Allowed comments: `eslint-disable*`/`eslint-enable` directives with `-- reason`, `@ts-expect-error` with description, shebang, `/// <reference`. Nothing else (no JSDoc, no TODO).
- Applies to `**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.mjs`; existing `ignores` still honored.
- Legacy frozen in `eslint-suppressions.json` (repo root, committed).
- `.editorconfig`: 2-space indent, LF, final newline. New files themselves contain no comments.
- No `--no-verify`; conventional commits; commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run `npm run build` before finishing.

## Review Focus

- Block comment containing both a directive word and prose (`/* eslint-disable no-x -- ok */` allowed; `/* see eslint-disable docs */` not) — allowlist must anchor at comment start.
- `eslint-disable` with no `-- reason` must fail (`require-description`).
- `@ts-ignore` / bare `@ts-expect-error` must fail.
- Shebang line in `.mjs` scripts must not be reported.
- Comment-looking text inside strings/template literals/JSX text must not be reported (only real comments).
- Suppressed legacy file gaining one extra comment must fail.

---

### Task 1: `no-comments` rule with tests

**Files:**
- Create: `eslint-rules/no-comments.mjs`
- Create: `eslint-rules/no-comments.test.mjs`
- Modify: `package.json` (add script `"test:lint-rules": "node --test eslint-rules/"`)

**Interfaces:**
- Produces: default export `rule` (ESLint rule object, `meta.messages.noComment`: `"Comments are not allowed. Express intent in names, types or tests. Only lint/TS directives with a reason are permitted."`), used as `local.rules['no-comments']` in Task 2.

- [ ] **Step 1: Write failing tests** in `eslint-rules/no-comments.test.mjs` using `RuleTester` from `eslint` and `node:test` (`RuleTester.describe`/`it` set to `node:test`'s). Cases:
  - valid: code with no comments; `const a = '// not a comment';`; `` `/* x */` `` template; `// eslint-disable-next-line no-console -- needed for CLI`; `/* eslint-disable no-console -- needed */`; `// @ts-expect-error -- upstream typing bug`; `/// <reference types="node" />`; `#!/usr/bin/env node\nfoo();` (shebang).
  - invalid (each expects one `noComment` error): `// hello`; `/* hello */`; `/** JSDoc */`; `// TODO: fix`; `/* see eslint-disable docs */`; `foo(); // trailing`.

- [ ] **Step 2: Run to confirm failure.** Run: `node --test eslint-rules/` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement the rule** in `eslint-rules/no-comments.mjs`. In `create(context)`, on `Program:exit` iterate `context.sourceCode.getAllComments()`; skip `comment.type === 'Shebang'`; skip when `comment.value.trim()` matches `^(eslint-(disable|enable)(-next-line|-line)?\b|@ts-expect-error\b|\/\s*<reference\b)`; otherwise `context.report({ loc: comment.loc, messageId: 'noComment' })`. Rule `meta.type: 'suggestion'`, no fixer, `schema: []`.

- [ ] **Step 4: Run tests.** Run: `node --test eslint-rules/` — Expected: all PASS.

- [ ] **Step 5: Add `test:lint-rules` script to `package.json` and commit.**
```bash
git add eslint-rules package.json
git commit -m "feat: add local no-comments eslint rule"
```

### Task 2: Wire rule and directive hygiene into the config

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `package.json` / `package-lock.json` (devDependency `@eslint-community/eslint-plugin-eslint-comments@^4.8.1`)

**Interfaces:**
- Consumes: `eslint-rules/no-comments.mjs` default export from Task 1.
- Produces: a config where `npm run lint:check` reports `local/no-comments`, `@eslint-community/eslint-comments/require-description`, and unused disable directives as errors.

- [ ] **Step 1: Prove the gap.** Create scratch file `packages/utils/src/tmp-comment.ts` containing `// hello\nexport const a = 1;`. Run: `npx eslint packages/utils/src/tmp-comment.ts` — Expected: no error (rule not wired yet).

- [ ] **Step 2: Install plugin.** Run: `npm i -D @eslint-community/eslint-plugin-eslint-comments@^4.8.1`.

- [ ] **Step 3: Edit `eslint.config.mjs`.** Add a final config block with `files: ['**/*.ts','**/*.tsx','**/*.js','**/*.jsx','**/*.mjs']`, `plugins: { local: { rules: { 'no-comments': noComments } }, '@eslint-community/eslint-comments': eslintComments }`, `linterOptions: { reportUnusedDisableDirectives: 'error' }`, rules `'local/no-comments': 'error'` and `'@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }]`. In the existing `**/*.ts, **/*.tsx` block set `'@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }]`. Remove every comment from `eslint.config.mjs` if any.

- [ ] **Step 4: Verify the scratch file now fails and a reasoned directive passes.** Run: `npx eslint packages/utils/src/tmp-comment.ts` — Expected: one `local/no-comments` error. Replace the comment with `// eslint-disable-next-line no-console -- reason` + a `console.log(1);` line: Expected: no error. Delete the scratch file.

- [ ] **Step 5: Commit.**
```bash
git add eslint.config.mjs package.json package-lock.json
git commit -m "build: enforce no-comments and directive hygiene in eslint"
```

### Task 3: Freeze legacy, prune script, docs, end-to-end proof

**Files:**
- Create: `eslint-suppressions.json` (generated)
- Modify: `package.json` (script `"lint:prune": "eslint --prune-suppressions ."`)
- Modify: `AGENTS.md` (Code Quality section)

**Interfaces:**
- Consumes: the wired config from Task 2.
- Produces: `npm run lint:check` exits 0 on the tree; `npm run lint:prune`.

- [ ] **Step 1: Confirm tree fails.** Run: `npm run lint:check` — Expected: many `local/no-comments` errors.

- [ ] **Step 2: Generate suppressions.** Run: `npx eslint . --suppress-rule local/no-comments --suppress-rule @eslint-community/eslint-comments/require-description`. Then `npm run lint:check` — Expected: exit 0. If failures remain that suppressions cannot cover (unused `eslint-disable` directives are not rules), delete those stale directives by hand until it passes; do not suppress other rules.

- [ ] **Step 3: Prove the ratchet.** Append `// new comment` to a file listed in `eslint-suppressions.json` that has no remaining headroom — `npm run lint:check` Expected: FAIL for that file. Revert the edit. Then delete one existing comment in a suppressed file and run `npm run lint:prune` — Expected: `eslint-suppressions.json` count for that file decreases.

- [ ] **Step 4: Prove lint-staged path.** Stage a file with a new comment and run `npx lint-staged` — Expected: FAIL; unstage and revert. Stage an untouched suppressed file — Expected: PASS (suppressions must not trip `--max-warnings 0`). If it fails, adjust the lint-staged command in `package.json` minimally (e.g. add `--pass-on-unpruned-suppressions`) and re-test.

- [ ] **Step 5: Document.** In `AGENTS.md` Code Quality add a "No comments" bullet: comments are rejected by `local/no-comments`; only `eslint-disable ... -- reason`, `@ts-expect-error` with description, shebang, triple-slash references allowed; legacy frozen in `eslint-suppressions.json`; run `npm run lint:prune` after deleting legacy comments and commit the file.

- [ ] **Step 6: Final verification.** Run: `npm run test:lint-rules && npm run lint:check && npm run build` — Expected: all exit 0.

- [ ] **Step 7: Commit.**
```bash
git add eslint-suppressions.json package.json AGENTS.md
git commit -m "chore: freeze legacy comments with eslint suppressions"
```
