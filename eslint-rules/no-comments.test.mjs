import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import rule from './no-comments.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const noComment = [{ messageId: 'noComment' }];

ruleTester.run('no-comments', rule, {
  valid: [
    'const a = 1;',
    "const a = '// not a comment';",
    'const a = `/* not a comment */`;',
    '// eslint-disable-next-line no-console -- needed for CLI\nconsole.log(1);',
    '/* eslint-disable no-console -- needed */\nconsole.log(1);',
    '// @ts-expect-error -- upstream typing bug\nconst a = 1;',
    '/// <reference types="node" />\nconst a = 1;',
    '#!/usr/bin/env node\nfoo();',
  ],
  invalid: [
    { code: '// hello\nconst a = 1;', errors: noComment },
    { code: '/* hello */\nconst a = 1;', errors: noComment },
    { code: '/** JSDoc */\nconst a = 1;', errors: noComment },
    { code: '// TODO: fix\nconst a = 1;', errors: noComment },
    { code: '/* see eslint-disable docs */\nconst a = 1;', errors: noComment },
    { code: 'foo(); // trailing', errors: noComment },
    { code: '// eslint-enable -- prose\nconst a = 1;', errors: noComment },
  ],
});
