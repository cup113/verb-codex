module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 moved the worklet transform into react-native-worklets;
  // `react-native-reanimated/plugin` is only a re-export of this one.
  // It has to stay last in the plugin list.
  plugins: ['react-native-worklets/plugin'],
};
