/* eslint-disable @typescript-eslint/no-require-imports */
// Test doubles for native modules that have no JavaScript implementation under Jest.

jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string | number | boolean>>();
  return {
    createMMKV: ({ id }: { id: string } = { id: 'default' }) => {
      const data = stores.get(id) ?? new Map();
      stores.set(id, data);
      return {
        set: (key: string, value: string | number | boolean) => void data.set(key, value),
        getString: (key: string) => {
          const value = data.get(key);
          return typeof value === 'string' ? value : undefined;
        },
        remove: (key: string) => data.delete(key),
        clearAll: () => data.clear(),
      };
    },
  };
});

require('react-native-gesture-handler/jestSetup');

// Gesture Handler asks Worklets for the UI runtime on a microtask; that runtime does not exist under Jest.
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: <T,>(component: T) => component,
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
}));
