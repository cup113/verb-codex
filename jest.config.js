module.exports = {
  preset: '@react-native/jest-preset',
  // Reanimated 4 ships a resolver rather than a setup file: it routes a few
  // of its own modules to their non-native implementations under jest.
  resolver: 'react-native-reanimated/jest/resolver',
  // `setupFiles` is concatenated onto the preset's own.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Replaces the preset's pattern, so the preset's entries are repeated here
  // alongside every ESM-only package this app pulls in.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context|@react-native-async-storage|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-draggable-flatlist)/)',
  ],
};
