module.exports = {
  preset: '@react-native/jest-preset',
  // `setupFiles` is concatenated onto the preset's own, so the React Native
  // mocks stay in place and this one only adds the storage double.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Replaces the preset's pattern, so it repeats the preset's entries and adds
  // the ESM-only packages this app pulls in.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context|@react-native-async-storage)/)',
  ],
};
