import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card } from '../../components/ui';
import { useTheme } from '../../theme';
import { runtime } from '../../core/runtime';
import { micLabel } from '../../core/voice/micOptions';

const BARS = 36;
const MAX_TEST_SECONDS = 8;

type Stage = 'idle' | 'recording' | 'transcribing' | 'done';

/** Records a few seconds with the selected microphone and shows level + what Whisper heard. */
export function MicTest() {
  const t = useTheme();
  const [stage, setStage] = useState<Stage>('idle');
  const [bars, setBars] = useState<number[]>(new Array(BARS).fill(0));
  const [secs, setSecs] = useState(0);
  const [result, setResult] = useState<{ text: string; peak: number; rotatedTo: string | null } | null>(null);
  const [error, setError] = useState('');
  const levels = useRef<number[]>(new Array(BARS).fill(0));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    runtime.stt.onLevel = undefined;
  };
  useEffect(() => cleanup, []);

  const stop = async () => {
    cleanup();
    setStage('transcribing');
    try {
      const text = await runtime.stt.stopAndTranscribe();
      const rec = runtime.stt.lastRecording;
      setResult({ text, peak: rec.peak, rotatedTo: rec.rotatedTo ? micLabel(rec.rotatedTo) : null });
    } catch (e) {
      setError((e as Error).message);
    }
    setStage('done');
  };

  const start = async () => {
    setError('');
    setResult(null);
    levels.current = new Array(BARS).fill(0);
    setBars(levels.current.slice());
    setSecs(0);
    try {
      await runtime.stt.startListening();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    runtime.stt.onLevel = l => {
      levels.current.push(l);
      levels.current.shift();
    };
    const began = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setBars(levels.current.slice());
      setSecs(s);
      if (s >= MAX_TEST_SECONDS) {
        stop();
      }
    }, 90);
    setStage('recording');
  };

  const verdict = (peak: number) =>
    peak < 0.05
      ? { color: t.danger, text: 'Silent. This microphone recorded nothing. Pick a different option above, then test again.' }
      : peak < 0.2
        ? { color: t.danger, text: 'Very quiet. Speak closer, or try another microphone option.' }
        : { color: t.ok, text: 'Good level.' };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: t.text, fontWeight: '600' }}>Microphone test</Text>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        Tap Start, say "Remind me tomorrow at 9 AM to call John", then tap Stop.
      </Text>

      {stage === 'recording' ? (
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {bars.map((b, i) => (
            <View
              key={i}
              style={{ width: 4, height: 4 + b * 40, borderRadius: 2, backgroundColor: b > 0.08 ? t.accent : t.border }}
            />
          ))}
        </View>
      ) : null}
      {stage === 'recording' ? <Text style={{ color: t.textDim }}>Recording… {secs}s</Text> : null}
      {stage === 'transcribing' ? <Text style={{ color: t.textDim }}>Transcribing…</Text> : null}

      {result ? (
        <View style={{ gap: 4 }}>
          {result.rotatedTo ? (
            <Text style={{ color: t.accent }}>
              That microphone was silent, so I switched to the {result.rotatedTo.toLowerCase()}. Tap Test again.
            </Text>
          ) : null}
          <Text style={{ color: verdict(result.peak).color }}>
            Level {Math.round(result.peak * 100)}%. {verdict(result.peak).text}
          </Text>
          <Text style={{ color: t.text }}>
            {result.text ? `Heard: “${result.text}”` : 'No words were recognized.'}
          </Text>
        </View>
      ) : null}
      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}

      {stage === 'recording' ? (
        <Button label="Stop" onPress={stop} />
      ) : (
        <Button label={stage === 'done' ? 'Test again' : 'Start test'} onPress={start} disabled={stage === 'transcribing'} />
      )}
    </Card>
  );
}
