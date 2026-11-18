import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import expo from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/.expo/',
    '**/web-build/',
    '**/ios/',
    '**/android/',
    '**/expo-env.d.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  comments.recommended,
  {
    rules: {
      // `any` només amb `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- motiu`
      '@typescript-eslint/no-explicit-any': 'error',
      '@eslint-community/eslint-comments/require-description': 'error',
      // `_next`: Express només reconeix el handler d'errors si té els 4 paràmetres
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Scripts de Node en JavaScript (supabase/scripts i scripts/sm): sense TypeScript, no-undef
    // necessita els globals.
    files: ['supabase/scripts/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', fetch: 'readonly' } },
  },
  {
    files: ['apps/mobile/**'],
    extends: [expo],
    settings: {
      'import/resolver': { typescript: { project: 'apps/mobile/tsconfig.json' } },
    },
  },
  prettier,
]);
