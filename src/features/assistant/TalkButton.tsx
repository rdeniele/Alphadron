import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Microphone, Stop } from 'phosphor-react-native';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { useTheme } from '../../theme';

/**
 * Tap to start recording (a RecordingBar with Cancel / Done then takes over).
 * The microphone only opens after a tap and the bar makes that obvious; there is
 * no always-on listening. While the assistant is speaking, tapping stops it.
 * `compact` renders just the round button (for the chat input bar).
 */
export function TalkButton({ size = 112, compact }: { size?: number; compact?: boolean }) {
  const t = useTheme();
  const { phase, startRecording, stopSpeaking } = useAssistant();
  const speaking = phase === 'speaking';
  const busy = phase !== 'idle' && phase !== 'speaking';

  const btn = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Stop speaking' : 'Tap to talk'}
      disabled={busy}
      onPress={speaking ? stopSpeaking : startRecording}
      style={({ pressed }) => [
        s.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: compact ? t.surface : t.accent,
          borderWidth: compact ? 1 : 0,
          borderColor: t.border,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      {speaking ? (
        <Stop size={size * 0.44} color={compact ? t.accent : t.onAccent} weight="fill" />
      ) : (
        <Microphone
          size={size * (compact ? 0.5 : 0.42)}
          color={compact ? t.accent : t.onAccent}
          weight={compact ? 'regular' : 'fill'}
        />
      )}
    </Pressable>
  );

  if (compact) {
    return btn;
  }
  return (
    <View style={s.wrap}>
      {btn}
      <Text style={{ color: t.textDim }}>{busy || speaking ? PHASE_LABEL[phase] : 'Tap to talk'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  btn: { alignItems: 'center', justifyContent: 'center' },
});
