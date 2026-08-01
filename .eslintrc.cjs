/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist/', 'node_modules/', 'public/', '*.config.js', '*.config.ts'],
  rules: {
    // Allow explicit `any` where the codebase intentionally uses it for
    // error handling and dynamic API responses.
    '@typescript-eslint/no-explicit-any': 'off',

    // Allow non-null assertions (e.g. `pillars[0]!`) used for indexed access.
    '@typescript-eslint/no-non-null-assertion': 'off',

    // Warn on unused variables but ignore those prefixed with underscore.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // Allow `require()` in CommonJS modules.
    '@typescript-eslint/no-var-requires': 'off',

    // Console logging is handled by the Winston logger; flag stray console calls.
    'no-console': 'warn',

    // Prefer const for variables that are never reassigned.
    'prefer-const': 'warn',

    // Enforce consistent spacing inside braces.
    'object-curly-spacing': ['warn', 'always'],

    // Allow empty catch blocks that intentionally swallow errors.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
