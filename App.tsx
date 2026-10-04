import React from 'react';
import { StatusBar, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from './src/services/AppState';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme';

function Themed() {
  const { settings } = useApp();
  return (
    <ThemeProvider mode={settings.theme}>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const t = useTheme();
  return (
    <NavigationContainer>
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider fallback={() => <View style={{ flex: 1, backgroundColor: '#0B0F14' }} />}>
        <Themed />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
