// ESLint v10 flat config. Minimal — TypeScript only.
// We dropped eslint-config-next because the eslint-plugin-react bundled
// inside it (v7.x) calls a pre-ESLint-10 context API and crashes on every
// .ts/.tsx file when run under ESLint 10.x. Next 16 still type-checks via
// `next build`; semantic React rules can be re-introduced once the upstream
// chain catches up.
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'next-env.d.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
