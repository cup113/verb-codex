const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

// Only its stack-frame collapsing matters on Android; the rest of that
// wrapper exists for the .windows fallback.
module.exports = wrapWithReanimatedMetroConfig(
  mergeConfig(getDefaultConfig(__dirname), config),
);
