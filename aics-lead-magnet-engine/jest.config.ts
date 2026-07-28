module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/types/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  // Prevent tests from accessing external APIs unless explicitly mocked
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Timeout per test — PDF may be slow
  testTimeout: 30_000,
  // Force exit after tests to clean up lingering handles
  forceExit: true,
  // Global setup / teardown
  globalTeardown: '<rootDir>/tests/teardown.ts',
  // Environment variables for tests
  setupFiles: ['<rootDir>/tests/setup.ts'],
};