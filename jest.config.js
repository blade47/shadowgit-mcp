module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],  // Run all test files
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Map both with and without .js extension
    '^@modelcontextprotocol/sdk/server/index.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/index.js',
    '^@modelcontextprotocol/sdk/server/stdio.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/stdio.js',
    '^@modelcontextprotocol/sdk/types.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/types.js',
    '^@modelcontextprotocol/sdk/server/index$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/index.js',
    '^@modelcontextprotocol/sdk/server/stdio$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/stdio.js',
    '^@modelcontextprotocol/sdk/types$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/types.js'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/shadowgit-mcp-server.ts', // Main entry point
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 10000,
  setupFilesAfterEnv: [],
  clearMocks: true,
  restoreMocks: true,
};