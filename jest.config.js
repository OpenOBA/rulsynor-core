/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: { module: 'nodenext', moduleResolution: 'nodenext', target: 'ES2022', lib: ['ES2022'] },
      diagnostics: { ignoreCodes: ['TS151002', 'TS1343'] },
    }],
  },
};
