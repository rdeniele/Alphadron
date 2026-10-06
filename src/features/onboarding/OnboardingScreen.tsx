import React from 'react';
import { Text, View } from 'react-native';
import { ModelsPanel } from '../models/ModelsPanel';
import { Button, Logo, Screen, SectionTitle } from '../../components/ui';
import { useTheme } from '../../theme';
import { useApp } from '../../services/AppState';

export function OnboardingScreen() {
  const t = useTheme();
  const { update } = useApp();
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 }}>
        <Logo size={132} />
        <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: 6, marginTop: 6 }}>ALPHADRON</Text>
        <Text style={{ color: t.textDim, fontSize: 16, textAlign: 'center', letterSpacing: 0.3 }}>
          Your private AI, right on your phone.
        </Text>
      </View>

      <Text style={{ color: t.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
        Everything stays on this device. Reminders, tasks, and notes work right away. The AI models are large files that
        download once, and Wi-Fi is best. Nothing downloads until you tap Download.
      </Text>

      <SectionTitle>Offline AI</SectionTitle>
      <ModelsPanel />

      <View style={{ marginTop: 6 }}>
        <Button label="Let's go" onPress={() => update('onboardingDone', true)} />
      </View>
      <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center' }}>
        You can download the models later from Settings.
      </Text>
    </Screen>
  );
}
