/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/apps/**/main.ts',
    '!src/apps/**/bootstrap.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.types.ts',
    '!src/**/*.d.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/index.ts',
    '!src/common/pagination/api-paginated-response.decorator.ts',
    '!src/database/migrations/*.ts',
    '!src/database/*-cli.ts',
    '!src/database/seeds/seed-runner.ts',
    '!src/database/seeds/seed.registry.ts',
    '!src/database/data-source.ts',
    '!src/database/database-options.ts',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
          transform: { decoratorMetadata: true },
          target: 'es2023',
        },
        module: { type: 'commonjs' },
        sourceMaps: 'inline',
      },
    ],
  },
};
