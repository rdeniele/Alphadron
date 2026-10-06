import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { runtime, type Phase } from '../../core/runtime';
import {
  createConversation,
  currentConversationId,
  listMessages,
  type ChatMessage,
} from '../../database/repositories/conversationsRepo';
import { useApp } from '../../services/AppState';

interface AssistantCtx {
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
  const starting = useRef<Promise<void> | null>(null);

  const reload = useCallback(async () => {
    const id = await currentConversationId();
    setMessages(await listMessages(id, 100));
  }, []);

  useEffect(() => {
    runtime.stt.micSource = settings.micSource;
  }, [settings.micSource]);

  // Apply the model chosen in Settings (unloads the other one if needed).
  useEffect(() => {
    runtime.provider.setPreferred(settings.aiModel);
  }, [settings.aiModel]);

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
      // Show the user's message immediately.
      setMessages(m => [
        ...m,
        { id: -Date.now(), conversationId: 0, role: 'user', content: clean, toolJson: null, createdAt: Date.now() },
      ]);
      try {
        await runtime.sendText(clean, { memoryEnabled: memoryEnabled.current, speak });
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
        await send(text, true);
      } else {
        const { peak } = runtime.stt.lastRecording;
        setError(
          peak < 0.05
            ? 'The microphone recorded silence. Try another microphone in Settings → Microphone, then run the mic test.'
            : "I couldn't make out words. Speak a little closer and clearly, or try a different microphone in Settings.",
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
    () => ({ messages, phase, error, dataVersion, send, startRecording, finishRecording, cancelRecording, stopSpeaking, newChat, reload, refresh }),
    [messages, phase, error, dataVersion, send, startRecording, finishRecording, cancelRecording, stopSpeaking, newChat, reload, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAssistant = () => useContext(Ctx);

export const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  listening: 'Listening… release to send',
  transcribing: 'Transcribing…',
  checking: 'Checking…',
  loading: 'Waking up the AI…',
  thinking: 'Thinking…',
  acting: 'Saving…',
  speaking: 'Speaking…',
};
