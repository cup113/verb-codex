import { useEffect } from 'react';
import { AppState, StatusBar, StyleSheet } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from './src/theme';
import { verbStore } from './src/storage/verbStore';
import { VerbListScreen } from './src/screens/VerbListScreen';
import { VerbDetailScreen } from './src/screens/VerbDetailScreen';
import { AddVerbScreen } from './src/screens/AddVerbScreen';
import { BackupScreen } from './src/screens/BackupScreen';
import { requestPersistentStorage } from './src/platform/persistentStorage';
import type { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const paperTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    primary: colors.terracotta,
    border: colors.line,
  },
};

function App() {
  useEffect(() => {
    verbStore.init();
    // A no-op on Android, an actual request on the web: browser storage is
    // best-effort unless the origin asks otherwise.
    requestPersistentStorage();
    // A memo must survive being swiped away: flush pending keystrokes when the
    // app stops being the foreground app.
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        verbStore.flush();
      }
    });
    return () => subscription.remove();
  }, []);

  // Gesture handler needs to own the root view; everything else nests inside.
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer theme={paperTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
            }}
          >
            <Stack.Screen name="VerbList" component={VerbListScreen} />
            <Stack.Screen name="VerbDetail" component={VerbDetailScreen} />
            <Stack.Screen name="Backup" component={BackupScreen} />
            <Stack.Screen
              name="AddVerb"
              component={AddVerbScreen}
              options={{ presentation: 'modal' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
