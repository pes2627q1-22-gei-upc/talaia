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
  {
    // ADR-0032: els colors canvien en mode nit, i per això van pel tema.
    files: ['apps/mobile/src/**'],
    ignores: [
      'apps/mobile/src/core/theme/**',
      '**/__tests__/**',
      // El canvas del mapa sempre va amb la paleta normal: en mode nit, el filtre el passa a vermell.
      'apps/mobile/src/features/map/style/nightStyle.ts',
      // La intro de la benvinguda queda en el tema normal.
      'apps/mobile/src/features/auth/intro/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/core/theme/tokens',
              importNames: [
                'colors',
                'gradients',
                'pointMapColors',
                'colorsVermell',
                'gradientsVermell',
                'pointMapColorsVermell',
              ],
              message: 'Els colors canvien amb el tema: useTheme() o makeStyles() (ADR-0032).',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
