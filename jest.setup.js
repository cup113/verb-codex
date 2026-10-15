/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

// Under jest the worklets resolver loads its web implementation, where these
// two helpers throw by design ('not supported on web'). Gesture handler still
// asks for the UI runtime holder when its root view mounts, and that throw
// happens inside a queued microtask, so it surfaces as a test failure long
// after the call site. Neither function can do anything useful without a
// native runtime, so they get harmless stubs.
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return {
    ...actual,
    getUIRuntimeHolder: () => ({}),
    getUISchedulerHolder: () => ({}),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
