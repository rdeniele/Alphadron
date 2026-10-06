import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Microphone, Stop } from 'phosphor-react-native';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { AccentFill } from '../../components/ui';
import { useTheme } from '../../theme';

/**
 * Tap to start recording (a RecordingBar with Cancel / Done then takes over).
 * The microphone only opens after a tap and the bar makes that obvious; there is
 * no always-on listening. While the assistant is speaking, tapping stops it.
 * `compact` renders just the round glass button (for the chat input bar).
 */
export function TalkButton({ size = 112, compact }: { size?: number; compact?: boolean }) {
  const t = useTheme();
  const { phase, startRecording, stopSpeaking } = useAssistant();
  const speaking = phase === 'speaking';
  const busy = phase !== 'idle' && phase !== 'speaking';
  const iconColor = compact ? t.accent : t.onAccent;

  const icon = speaking ? (
    <Stop size={size * 0.42} color={iconColor} weight="fill" />
  ) : (
    <Microphone size={size * (compact ? 0.5 : 0.42)} color={iconColor} weight={compact ? 'regular' : 'fill'} />
  );

  const btn = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Stop speaking' : 'Tap to talk'}
      disabled={busy}
      onPress={speaking ? stopSpeaking : startRecording}
      style={({ pressed }) => ({ opacity: busy ? 0.5 : pressed ? 0.88 : 1 })}>
      {compact ? (
        <View
          style={[
            s.btn,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
          ]}>
          {icon}
        </View>
      ) : (
        <AccentFill style={[s.btn, s.glow, { width: size, height: size, borderRadius: size / 2 }]}>{icon}</AccentFill>
      )}
    </Pressable>
  );

  if (compact) {
    return btn;
  }
  return (
    <View style={s.wrap}>
      {/* A thin outer ring echoes the rings in the backdrop. */}
      <View style={{ width: size + 20, height: size + 20, borderRadius: (size + 20) / 2, borderWidth: 1.5, borderColor: t.ring, alignItems: 'center', justifyContent: 'center' }}>
        {btn}
      </View>
      <Text style={{ color: t.textDim, fontSize: 13, letterSpacing: 0.4 }}>{busy || speaking ? PHASE_LABEL[phase] : 'Tap to talk'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    shadowColor: '#FF4D8D',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
