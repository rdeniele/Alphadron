import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from './src/services/AppState';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme';
import { rescheduleAll } from './src/core/reminders/scheduler';
import { runtime } from './src/core/runtime';
import { platform } from './src/platform';
import { removeLegacyModels } from './src/core/ai/modelManager';

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
  const { settings } = useApp();
  // Apply the alert style and re-register every pending alert (also survives reboot/update).
  useEffect(() => {
    platform.notifications.setAlertPrefs({ sound: settings.alertSound, style: settings.alertStyle });
    rescheduleAll().catch(() => undefined);
  }, [settings.alertSound, settings.alertStyle]);
  useEffect(() => {
    removeLegacyModels().catch(() => undefined);
    return () => {
      runtime.releaseAll();
    };
  }, []);
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
