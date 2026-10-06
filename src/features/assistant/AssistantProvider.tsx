import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { runtime, type Phase } from '../../core/runtime';
import {
  createConversation,
  currentConversationId,
  listMessages,
  type ChatMessage,
} from '../../database/repositories/conversationsRepo';
import { useApp } from '../../services/AppState';
import { getPreference, setPreference } from '../../database/repositories/settingsRepo';
import { MIC_OPTIONS, micLabel, type MicSource } from '../../core/voice/micOptions';

export interface LastTurn {
  user: string;
  reply: string;
  chip: { ok: boolean; label: string } | null;
  spoken: boolean;
}

interface AssistantCtx {
  /** Most recent exchange, so screens other than Chat (e.g. Home) can show the result. */
  lastTurn: LastTurn | null;
  /** What speech recognition just heard, shown while the assistant works on it. */
  heard: string | null;
  dismissLastTurn: () => void;
  messages: ChatMessage[];
  phase: Phase;
  error: string | null;
  /** Increments whenever an action may have changed tasks/reminders/etc., so screens can refresh. */
  dataVersion: number;
  send: (text: string, speak?: boolean) => Promise<void>;
  /** Tap-to-record flow: start -> (cancel | finish & send). */
  startRecording: () => Promise<void>;
  finishRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  stopSpeaking: () => Promise<void>;
  newChat: () => Promise<void>;
  reload: () => Promise<void>;
  /** Call after any data change made outside the assistant (manual add/edit). */
  refresh: () => void;
}

const Ctx = createContext<AssistantCtx>(null as unknown as AssistantCtx);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const memoryEnabled = useRef(settings.memoryEnabled);
  memoryEnabled.current = settings.memoryEnabled;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [lastTurn, setLastTurn] = useState<LastTurn | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const starting = useRef<Promise<void> | null>(null);

  const reload = useCallback(async () => {
    const id = await currentConversationId();
    setMessages(await listMessages(id, 100));
  }, []);

  // Microphone: 'auto' remembers the source that worked on this phone.
  useEffect(() => {
    runtime.stt.setting = settings.micSource;
  }, [settings.micSource]);
  useEffect(() => {
    getPreference('mic_resolved').then(v => {
      if (v && MIC_OPTIONS.some(o => o.key === v)) {
        runtime.stt.resolved = v as MicSource;
      }
    });
    runtime.stt.onResolved = s => {
      setPreference('mic_resolved', s);
    };
    return () => {
      runtime.stt.onResolved = undefined;
    };
  }, []);

  useEffect(() => {
    runtime.onPhase = setPhase;
    reload();
    // Preload the model shortly after launch so the first model answer isn't slow.
    const warm = setTimeout(() => runtime.warmUp(), 1500);
    return () => {
      clearTimeout(warm);
      runtime.onPhase = undefined;
    };
  }, [reload]);

  const send = useCallback(
    async (text: string, speak = false) => {
      const clean = text.trim();
      if (!clean) {
        return;
      }
      setError(null);
      setLastTurn(null);
      // Show the user's message immediately.
      setMessages(m => [
        ...m,
        { id: -Date.now(), conversationId: 0, role: 'user', content: clean, toolJson: null, createdAt: Date.now() },
      ]);
      try {
        const res = await runtime.sendText(clean, { memoryEnabled: memoryEnabled.current, speak });
        setLastTurn({
          user: clean,
          reply: res.assistantMessage.content,
          chip: res.action ? { ok: res.action.result.ok, label: res.action.result.chip } : null,
          spoken: speak,
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        await reload();
        setDataVersion(v => v + 1);
      }
    },
    [reload],
  );

  const startRecording = useCallback(async () => {
    setError(null);
    const p = (async () => {
      try {
        await runtime.startTalking();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    starting.current = p;
    await p;
  }, []);

  const finishRecording = useCallback(async () => {
    // Done can be tapped before the mic finished starting (e.g. permission prompt).
    await starting.current;
    starting.current = null;
    if (runtime.stt.state !== 'listening') {
      return;
    }
    try {
      const text = await runtime.stopTalking();
      if (text) {
        setHeard(text);
        try {
          await send(text, true);
        } finally {
          setHeard(null);
        }
      } else {
        const { peak, rotatedTo } = runtime.stt.lastRecording;
        setError(
          rotatedTo
            ? `That microphone was silent, so I switched to the ${micLabel(rotatedTo).toLowerCase()}. Tap the mic and try again.`
            : peak < 0.05
              ? 'The microphone recorded silence. Check Settings → Microphone and run the mic test.'
              : "I couldn't make out any words. Try speaking a little closer and more clearly, then tap ✓.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [send]);

  // Hitting the maximum recording length behaves like tapping Done.
  useEffect(() => {
    runtime.stt.onAutoStop = () => {
      finishRecording();
    };
    return () => {
      runtime.stt.onAutoStop = undefined;
    };
  }, [finishRecording]);

  const cancelRecording = useCallback(async () => {
    await starting.current;
    starting.current = null;
    await runtime.cancelTalking();
  }, []);

  const dismissLastTurn = useCallback(() => setLastTurn(null), []);

  const stopSpeaking = useCallback(() => runtime.stopSpeaking(), []);
  const refresh = useCallback(() => {
    setDataVersion(v => v + 1);
    reload();
  }, [reload]);

  const newChat = useCallback(async () => {
    await createConversation('Chat');
    await reload();
  }, [reload]);

  const value = useMemo(
    () => ({ lastTurn, heard, dismissLastTurn, messages, phase, error, dataVersion, send, startRecording, finishRecording, cancelRecording, stopSpeaking, newChat, reload, refresh }),
    [lastTurn, heard, dismissLastTurn, messages, phase, error, dataVersion, send, startRecording, finishRecording, cancelRecording, stopSpeaking, newChat, reload, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAssistant = () => useContext(Ctx);

export const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  checking: 'Checking…',
  loading: 'Waking up the AI…',
  thinking: 'Thinking…',
  acting: 'Saving…',
  speaking: 'Speaking…',
};
