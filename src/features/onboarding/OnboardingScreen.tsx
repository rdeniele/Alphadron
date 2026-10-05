import React from 'react';
import { Text } from 'react-native';
import { ModelsPanel } from '../models/ModelsPanel';
import { Button, Screen } from '../../components/ui';
import { useTheme } from '../../theme';
import { useApp } from '../../services/AppState';

export function OnboardingScreen() {
  const t = useTheme();
  const { update } = useApp();
  return (
    <Screen>
      <Text style={{ color: t.text, fontSize: 32, fontWeight: '700', marginTop: 8 }}>Alphadex</Text>
      <Text style={{ color: t.textDim, fontSize: 15, lineHeight: 22 }}>
        Alphadex runs on your phone and your data stays on this device. Reminders, tasks and notes work right away. The AI
        models are large files that download once (Wi-Fi is best); nothing downloads until you tap Download.
      </Text>
      <ModelsPanel />
      <Button label="Continue" onPress={() => update('onboardingDone', true)} />
      <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center' }}>
        You can download models later from Settings.
      </Text>
    </Screen>
  );
}
