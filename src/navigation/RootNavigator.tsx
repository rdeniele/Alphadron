import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarCheck, GearSix, House, Notebook } from 'phosphor-react-native';
import { QuickAddProvider } from '../features/common/QuickAdd';
import { HomeScreen } from '../features/assistant/HomeScreen';
import { ChatModalProvider } from '../features/assistant/ChatModal';
import { PlanScreen } from '../features/tasks/PlanScreen';
import { MemoryScreen } from '../features/memory/MemoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { AssistantProvider } from '../features/assistant/AssistantProvider';
import { useApp } from '../services/AppState';
import { useTheme } from '../theme';

const Tab = createBottomTabNavigator();

type IconProps = { color: string; size: number };

export function RootNavigator() {
  const t = useTheme();
  const { settings } = useApp();
  if (!settings.onboardingDone) {
    return <OnboardingScreen />;
  }
  return (
    <AssistantProvider>
      <QuickAddProvider>
      <ChatModalProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.textDim,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: { backgroundColor: t.tabBar, borderTopColor: t.border, borderTopWidth: 1 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
        }}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: (p: IconProps) => <House {...p} /> }} />
        <Tab.Screen name="Plan" component={PlanScreen} options={{ tabBarIcon: (p: IconProps) => <CalendarCheck {...p} /> }} />
        <Tab.Screen name="Notes" component={MemoryScreen} options={{ tabBarIcon: (p: IconProps) => <Notebook {...p} /> }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: (p: IconProps) => <GearSix {...p} /> }} />
      </Tab.Navigator>
      </ChatModalProvider>
      </QuickAddProvider>
    </AssistantProvider>
  );
}
