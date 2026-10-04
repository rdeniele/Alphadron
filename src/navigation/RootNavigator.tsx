import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GearSix, House } from 'phosphor-react-native';
import { HomeScreen } from '../features/assistant/HomeScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { useApp } from '../services/AppState';
import { useTheme } from '../theme';

const Tab = createBottomTabNavigator();

export function RootNavigator() {
  const t = useTheme();
  const { settings } = useApp();
  if (!settings.onboardingDone) {
    return <OnboardingScreen />;
  }
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textDim,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color, size }) => <GearSix color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
