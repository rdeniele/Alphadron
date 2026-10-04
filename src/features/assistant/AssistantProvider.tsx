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
  pressTalk: () => Promise<void>;
  releaseTalk: () => Promise<void>;
  stopSpeaking: () => Promise<void>;
  newChat: () => Promise<void>;
  reload: () => Promise<void>;
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
    runtime.onPhase = setPhase;
    reload();
    return () => {
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

  const pressTalk = useCallback(async () => {
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

  const releaseTalk = useCallback(async () => {
    // A quick tap can release before the mic finished starting (e.g. permission prompt).
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
        setError("I didn't catch that. Hold the button while you speak.");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [send]);

  // Hitting the 30 s recording cap behaves like releasing the button.
  useEffect(() => {
    runtime.stt.onAutoStop = () => {
      releaseTalk();
    };
    return () => {
      runtime.stt.onAutoStop = undefined;
    };
  }, [releaseTalk]);

  const stopSpeaking = useCallback(() => runtime.stopSpeaking(), []);

  const newChat = useCallback(async () => {
    await createConversation('Chat');
    await reload();
  }, [reload]);

  const value = useMemo(
    () => ({ messages, phase, error, dataVersion, send, pressTalk, releaseTalk, stopSpeaking, newChat, reload }),
    [messages, phase, error, dataVersion, send, pressTalk, releaseTalk, stopSpeaking, newChat, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAssistant = () => useContext(Ctx);

export const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  listening: 'Listening… release to send',
  transcribing: 'Transcribing…',
  loading: 'Loading the AI model…',
  thinking: 'Thinking…',
  acting: 'Working on it…',
  speaking: 'Speaking…',
};
