/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Loads Reanimated's and Worklets' JavaScript implementations instead of the native ones (resolver shipped by Reanimated).
  resolver: 'react-native-reanimated/jest/resolver',
  clearMocks: true,
};
