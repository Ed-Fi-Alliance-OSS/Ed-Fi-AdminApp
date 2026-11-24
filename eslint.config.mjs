import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import * as parser from 'jsonc-eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { fixupConfigRules } from '@eslint/compat';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import noComments from './eslint-rules/no-comments.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/tmp',
      '**/.vscode',
      '**/migrations',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/tests/e2e/.features-gen',
      '**/packages/api/certification',
      '**/.nx',
    ],
  },
  ...fixupConfigRules(
    compat.extends(
      'plugin:jest/recommended',
      'plugin:jest/style',
      'eslint:recommended',
      'plugin:storybook/recommended'
    )
  ),
  {
    plugins: {
      '@nx': nx,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],

    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],

          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...compat.extends('plugin:@nx/typescript').map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],

    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['packages/fe/**/*.tsx', 'packages/common-ui/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  ...compat.extends('plugin:@nx/javascript').map((config) => ({
    ...config,
    files: ['**/*.js', '**/*.jsx'],
  })),
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.json'],

    languageOptions: {
      parser: parser,
    },

    rules: {},
  },
  {
    files: ['tests/e2e/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-var': 'off',
    },
  },
  {
    files: ['packages/api/src/test/helpers/**/*.ts'],
    rules: {
      'jest/no-export': 'off',
    },
  },
  {
    files: ['packages/api/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    plugins: {
      local: { rules: { 'no-comments': noComments } },
      '@eslint-community/eslint-comments': eslintComments,
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'local/no-comments': 'error',
      '@eslint-community/eslint-comments/require-description': 'error',
    },
  },
];
