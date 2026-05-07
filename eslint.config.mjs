import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
      '**/*.d.ts',
      '.idea',
      'out',
      '**/build',
      '**/dist',
      '**/public',
      '**/*-worker-wrapper.js',
      './packages/guis/navigator/*.ts',
    ],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'script',

      parserOptions: {
        tsconfigRootDir: __dirname,

        project: [
          './packages/apis/*/tsconfig.json',
          './packages/apps/*/tsconfig.json',
          './packages/clis/*/tsconfig.json',
          './packages/guis/*/tsconfig.json',
          './packages/libs/*/tsconfig.json',
        ],
      },
    },

    rules: {
      '@typescript-eslint/dot-notation': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          reportUsedIgnorePattern: true,
        },
      ],
    },
  },
  // Navigator architecture: layer-boundary enforcement.
  // See packages/apps/navigator/ARCHITECTURE.md for the rules.
  {
    files: ['packages/apps/navigator/src/**/*.{ts,tsx}'],
    ignores: ['packages/apps/navigator/src/services/map/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['maplibre-gl', 'react-map-gl/maplibre'],
              message:
                'services/map/ is the single maplibre boundary. Add a method to MapHandle/MapMarkers/MapCamera/MapStyle and call that.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/apps/navigator/src/stores/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/controllers/**',
                '**/services/**',
                '**/views/**',
                '**/components/**',
                '**/reactions/**',
              ],
              message:
                'stores/ are pure state + computeds. They must not depend on controllers/services/views/components/reactions.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/apps/navigator/src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/controllers/**', '**/views/**', '**/components/**'],
              message:
                'services/ must not depend on controllers/views/components.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/apps/navigator/src/reactions/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/controllers/**', '**/views/**', '**/components/**'],
              message:
                'reactions/ wire stores → services. Controllers and views are not their concern.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/apps/navigator/src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/stores/**',
                '**/controllers/**',
                '**/services/**',
                '**/reactions/**',
                'mobx',
                'mobx-react-lite',
              ],
              message:
                'components/ are pure presenters. Take everything as props; move store/controller/service/observer logic to views/.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  // tRPC clients live at the services boundary.
  {
    files: ['packages/apps/navigator/src/**/*.{ts,tsx}'],
    ignores: [
      'packages/apps/navigator/src/services/**',
      'packages/apps/navigator/src/index.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@trpc/client', '@trpc/server'],
              message:
                'tRPC clients live in services/ (route-api, search-api, telemetry).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  // Production code can't import test fixtures.
  {
    files: ['packages/apps/navigator/src/**/*.{ts,tsx}'],
    ignores: ['packages/apps/navigator/src/**/tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/tests/**'],
              message: 'Test fixtures stay inside tests/.',
            },
          ],
        },
      ],
    },
  },
];
