import nx from '@nx/eslint-plugin';
import parser from 'jsonc-eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { fixupConfigRules } from '@eslint/compat';

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
];
