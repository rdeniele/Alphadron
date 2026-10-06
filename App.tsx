import React, { useEffect, useMemo } from 'react';
import { StatusBar, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from './src/services/AppState';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme';
import { Backdrop } from './src/components/Backdrop';
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

  // Transparent navigation chrome so the glass backdrop shows through every screen.
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: t.dark,
      colors: { ...DefaultTheme.colors, background: 'transparent', card: 'transparent', text: t.text, border: t.border, primary: t.accent },
    }),
    [t],
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Backdrop />
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider fallback={() => <View style={{ flex: 1, backgroundColor: '#0C0B2B' }} />}>
        <Themed />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
