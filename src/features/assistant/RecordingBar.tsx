import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, X } from 'phosphor-react-native';
import { useAssistant } from './AssistantProvider';
import { runtime } from '../../core/runtime';
import { useTheme } from '../../theme';

const BARS = 32;

/**
 * Shown while recording: live input level (so you can see the mic hears you),
 * a timer, and two clear choices - Cancel (discard) or Done (transcribe + send).
 */
export function RecordingBar({ size = 56 }: { size?: number }) {
  const t = useTheme();
  const { cancelRecording, finishRecording } = useAssistant();
  const levels = useRef<number[]>(new Array(BARS).fill(0));
  const [bars, setBars] = useState<number[]>(levels.current.slice());
  const [secs, setSecs] = useState(0);
  const [heard, setHeard] = useState(false);

  useEffect(() => {
    const start = Date.now();
    runtime.stt.onLevel = lvl => {
      levels.current.push(lvl);
      levels.current.shift();
      if (lvl > 0.08) {
        setHeard(true);
      }
    };
    const id = setInterval(() => {
      setBars(levels.current.slice());
      setSecs(Math.floor((Date.now() - start) / 1000));
    }, 90);
    return () => {
      runtime.stt.onLevel = undefined;
      clearInterval(id);
    };
  }, []);

  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <View style={{ width: '100%', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={cancelRecording}
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          style={{
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <X size={24} color={t.danger} weight="bold" />
        </Pressable>

        <View
          style={{
            flex: 1,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: t.danger,
            backgroundColor: t.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
          }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.danger }} />
          <Text style={{ color: t.text, fontVariant: ['tabular-nums'], fontWeight: '600', width: 40 }}>{mm}</Text>
          <View style={{ flex: 1, height: size - 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {bars.map((b, i) => (
              <View
                key={i}
                style={{
                  width: 3,
                  height: 4 + b * (size - 28),
                  borderRadius: 2,
                  backgroundColor: b > 0.08 ? t.accent : t.border,
                }}
              />
            ))}
          </View>
        </View>

        <Pressable
          onPress={finishRecording}
          accessibilityRole="button"
          accessibilityLabel="Done, send"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Check size={28} color={t.onAccent} weight="bold" />
        </Pressable>
      </View>
      <Text style={{ color: heard ? t.textDim : t.danger, fontSize: 12, textAlign: 'center' }}>
        {heard ? 'Speak, then tap ✓ to send · ✕ to cancel' : "I can't hear you yet — speak closer to the mic"}
      </Text>
    </View>
  );
}
