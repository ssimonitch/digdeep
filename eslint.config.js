import eslintJs from '@eslint/js';
import globals from 'globals';
import eslintReact from 'eslint-plugin-react-x';
import eslintReactDom from 'eslint-plugin-react-dom';
import eslintReactHooks from 'eslint-plugin-react-hooks';
import eslintReactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      eslintJs.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      eslintReact.configs['recommended-typescript'],
      eslintReactDom.configs.recommended,
      eslintReactHooks.configs['recommended-latest'],
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
  eslintPluginPrettierRecommended,
);
