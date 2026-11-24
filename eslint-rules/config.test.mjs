import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const eslint = new ESLint();

async function lint(code, filePath = 'packages/utils/src/probe.ts') {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

describe('eslint config enforces the no-comments policy', () => {
  it('rejects disabling local/no-comments with a directive', async () => {
    const rules = await lint(
      '/* eslint-disable local/no-comments -- legacy */\n// prose\nexport const a = 1;\n'
    );
    assert.ok(rules.length > 0);
  });

  it('rejects a blanket eslint-disable even with a reason', async () => {
    const rules = await lint(
      '/* eslint-disable -- whatever */\n// prose\nexport const a = 1;\n'
    );
    assert.ok(rules.length > 0);
  });

  it('rejects eslint-enable used to carry prose', async () => {
    const rules = await lint(
      '// eslint-enable -- this function computes things\nexport const a = 1;\n'
    );
    assert.ok(rules.length > 0);
  });

  it('rejects a bare eslint-disable directive', async () => {
    const rules = await lint(
      '// eslint-disable-next-line no-console\nconsole.log(1);\n'
    );
    assert.ok(
      rules.includes(
        '@eslint-community/eslint-comments/require-description'
      )
    );
  });

  it('rejects a bare @ts-expect-error', async () => {
    const rules = await lint('// @ts-expect-error\nconst a: string = 1;\n');
    assert.ok(rules.includes('@typescript-eslint/ban-ts-comment'));
  });

  it('rejects comments in .mjs files', async () => {
    const rules = await lint(
      '// hello\nexport const a = 1;\n',
      'packages/api/scripts/probe.mjs'
    );
    assert.ok(rules.includes('local/no-comments'));
  });
});
