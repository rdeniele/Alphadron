import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatPanel } from './ChatScreen';
import { useAssistant } from './AssistantProvider';

interface Ctx {
  /** Opens the quick-chat popup. */
  open: () => void;
  close: () => void;
}

const ChatModalCtx = createContext<Ctx>({ open: () => undefined, close: () => undefined });
export const useChatModal = () => useContext(ChatModalCtx);

/**
 * Quick chat as a full-screen popup opened from Home. Chat is a conversation you dip into,
 * not a destination, so it does not need its own tab.
 */
export function ChatModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { phase, cancelRecording, stopSpeaking } = useAssistant();

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(async () => {
    setVisible(false);
    // Never leave the microphone open or the voice talking behind a closed popup.
    if (phase === 'listening') {
      await cancelRecording();
    }
    if (phase === 'speaking') {
      await stopSpeaking();
    }
  }, [phase, cancelRecording, stopSpeaking]);

  return (
    <ChatModalCtx.Provider value={{ open, close }}>
      {children}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
        navigationBarTranslucent>
        <SafeAreaProvider>
          <ChatPanel onClose={close} />
        </SafeAreaProvider>
      </Modal>
    </ChatModalCtx.Provider>
  );
}
