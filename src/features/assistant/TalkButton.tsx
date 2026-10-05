import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Microphone, Stop } from 'phosphor-react-native';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { useTheme } from '../../theme';

/**
 * Push-to-talk. The microphone is open ONLY while the button is held; the red
 * pulse makes that unmistakable. There is no always-on listening.
 * `compact` renders just the round button (for the chat input bar); the status
 * text is shown elsewhere so nothing sits beside the send/mic buttons.
 */
export function TalkButton({ size = 112, compact }: { size?: number; compact?: boolean }) {
  const t = useTheme();
  const { phase, pressTalk, releaseTalk, stopSpeaking } = useAssistant();
  const listening = phase === 'listening';
  const speaking = phase === 'speaking';
  const busy = phase !== 'idle' && !listening && !speaking;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const btn = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {listening ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.danger,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
          }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={speaking ? 'Stop speaking' : 'Hold to talk'}
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
            backgroundColor: listening ? t.danger : compact ? t.surface : t.accent,
            borderWidth: compact && !listening ? 1 : 0,
            borderColor: t.border,
            opacity: busy ? 0.5 : 1,
          },
        ]}>
        {speaking ? (
          <Stop size={size * 0.44} color={compact ? t.accent : t.onAccent} weight="fill" />
        ) : (
          <Microphone
            size={size * (compact ? 0.5 : 0.4)}
            color={listening ? '#fff' : compact ? t.accent : t.onAccent}
            weight={compact ? 'regular' : 'fill'}
          />
        )}
      </Pressable>
    </View>
  );

  if (compact) {
    return btn;
  }
  return (
    <View style={s.wrap}>
      {btn}
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
