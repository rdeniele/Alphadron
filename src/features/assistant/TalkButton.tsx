import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Microphone, Stop } from 'phosphor-react-native';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { useTheme } from '../../theme';

/**
 * Push-to-talk. The microphone is open ONLY while the button is held; the red
 * state and label make that unmistakable. There is no always-on listening.
 */
export function TalkButton({ size = 112 }: { size?: number }) {
  const t = useTheme();
  const { phase, pressTalk, releaseTalk, stopSpeaking } = useAssistant();
  const listening = phase === 'listening';
  const speaking = phase === 'speaking';
  const busy = phase !== 'idle' && !listening && !speaking;

  return (
    <View style={s.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={speaking ? 'Stop speaking' : 'Hold to talk to Alphadex'}
        disabled={busy}
        onPressIn={speaking ? undefined : pressTalk}
        onPressOut={speaking ? undefined : releaseTalk}
        onPress={speaking ? stopSpeaking : undefined}
        style={[
          s.btn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: listening ? t.danger : t.accent,
            opacity: busy ? 0.5 : 1,
            transform: [{ scale: listening ? 1.08 : 1 }],
          },
        ]}>
        {speaking ? (
          <Stop size={size * 0.4} color={t.onAccent} weight="fill" />
        ) : (
          <Microphone size={size * 0.4} color={listening ? '#fff' : t.onAccent} weight="fill" />
        )}
      </Pressable>
      <View style={s.labelRow}>
        {listening ? <View style={[s.dot, { backgroundColor: t.danger }]} /> : null}
        <Text style={{ color: listening ? t.danger : t.textDim, fontWeight: listening ? '700' : '400' }}>
          {listening || busy || speaking ? PHASE_LABEL[phase] : 'Hold to talk'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
