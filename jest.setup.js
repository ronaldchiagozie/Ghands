// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo modules
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true]),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

/**
 * Navigation is debounced in both apps (utils/navigationGuard): a second
 * move inside 700ms is swallowed, because a double-tap used to push the
 * same screen twice. Tests fire navigations back to back with no real
 * clock between them, so the lock is cleared before each one - otherwise
 * a test is asserting against the debounce rather than the routing.
 */
beforeEach(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./utils/navigationGuard').releaseNavigationLock();
  } catch {
    /* a suite that never loads the guard does not need it reset */
  }
});
