import eslintJs from '@eslint/js';
import globals from 'globals';
import erasableSyntaxOnly from 'eslint-plugin-erasable-syntax-only';
import eslintReact from 'eslint-plugin-react-x';
import eslintReactDom from 'eslint-plugin-react-dom';
import eslintReactHooks from 'eslint-plugin-react-hooks';
import eslintReactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginVitest from '@vitest/eslint-plugin';

export default tseslint.config(
  { ignores: ['dist', 'vitest.config.ts'] },
  {
    extends: [
      eslintJs.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      eslintReact.configs['recommended-typescript'],
      eslintReactDom.configs.recommended,
      eslintReactHooks.configs['recommended-latest'],
      erasableSyntaxOnly.configs.recommended,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-refresh': eslintReactRefresh,
      'simple-import-sort': simpleImportSort,
      import: eslintPluginImport,
    },
    rules: {
      'no-console': 'error',
      // eslint-plugin-simple-import-sort
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // eslint-plugin-import
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      // eslint-plugin-react-refresh
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Disable react-refresh warnings for shared UI components
  // These are foundational components that export utilities alongside components,
  // which is a common pattern in UI libraries (shadcn/ui, Radix UI)
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Allow console statements in error and performance monitoring services
  {
    files: [
      'src/shared/services/error-monitor.service.ts',
      'src/test/pose-detection/performance/performance-examples.ts',
      'src/test/pose-detection/performance/benchmark.test.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/test/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    plugins: {
      vitest: eslintPluginVitest,
    },
    rules: {
      ...eslintPluginVitest.configs.recommended.rules,
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  eslintPluginPrettierRecommended,
);
