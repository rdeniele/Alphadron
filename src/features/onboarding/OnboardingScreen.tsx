import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModelsPanel } from '../models/ModelsPanel';
import { useTheme } from '../../theme';
import { useApp } from '../../services/AppState';

export function OnboardingScreen() {
  const t = useTheme();
  const { update } = useApp();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[s.h1, { color: t.text }]}>Alphadex</Text>
        <Text style={{ color: t.textDim, fontSize: 15, lineHeight: 22 }}>
          Alphadex runs on your phone. Your data stays on this device. The AI models are large files
          that must be downloaded once, over Wi-Fi is best. Nothing downloads until you tap Download.
        </Text>
        <ModelsPanel />
        <Pressable
          onPress={() => update('onboardingDone', true)}
          style={[s.cta, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.onAccent, fontWeight: '700' }}>Continue</Text>
        </Pressable>
        <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center' }}>
          You can download models later from Settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  h1: { fontSize: 32, fontWeight: '700' },
  cta: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
