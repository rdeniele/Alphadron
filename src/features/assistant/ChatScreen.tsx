import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUp,
  Bell,
  CalendarBlank,
  CheckCircle,
  CheckSquare,
  Note,
  Plus,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { useApp } from '../../services/AppState';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { TalkButton } from './TalkButton';
import { RecordingBar } from './RecordingBar';
import { useQuickAdd, type AddMode } from '../common/QuickAdd';
import { AccentFill, Chip, Logo, Row, Sheet, useLayout } from '../../components/ui';
import { useTheme } from '../../theme';
import { runtime } from '../../core/runtime';
import type { ChatMessage } from '../../database/repositories/conversationsRepo';

const SUGGESTIONS = [
  "Hi! How's it going?",
  'Remind me tomorrow at 9 AM to work on my project',
  'What do I have tomorrow?',
  'What should I work on today?',
];

function Bubble({ m, maxWidth }: { m: ChatMessage; maxWidth: number }) {
  const t = useTheme();
  const mine = m.role === 'user';
  let chip: { ok: boolean; label: string } | null = null;
  if (m.toolJson) {
    try {
      const j = JSON.parse(m.toolJson);
      chip = { ok: !!j.ok, label: String(j.chip) };
    } catch {
      chip = null;
    }
  }
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
      {mine ? (
        <AccentFill style={[s.bubble, { maxWidth, borderBottomRightRadius: 6 }]}>
          <Text selectable style={{ color: t.onAccent, fontSize: 16, lineHeight: 23, fontWeight: '500' }}>
            {m.content}
          </Text>
        </AccentFill>
      ) : (
        <View style={[s.bubble, { maxWidth, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderBottomLeftRadius: 6 }]}>
          <Text selectable style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>
            {m.content}
          </Text>
        </View>
      )}
      {chip ? (
        <View style={s.chip}>
          {chip.ok ? <CheckCircle size={16} color={t.ok} weight="fill" /> : <WarningCircle size={16} color={t.danger} weight="fill" />}
          <Text style={{ color: chip.ok ? t.ok : t.danger, fontSize: 13 }}>{chip.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Shown while the assistant works so the screen is never blank. */
function WorkingBubble({ maxWidth }: { maxWidth: number }) {
  const t = useTheme();
  const { phase } = useAssistant();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(320 - i * 160),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    const timer = setInterval(() => setSecs(x => x + 1), 1000);
    return () => {
      loops.forEach(l => l.stop());
      clearInterval(timer);
    };
  }, [dots]);

  const slow = phase === 'loading' ? 'The first answer takes a little longer while the AI loads' : secs >= 6 ? 'Still working…' : '';
  return (
    <View style={{ alignItems: 'flex-start', marginVertical: 4 }}>
      <View style={[s.bubble, { maxWidth, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderBottomLeftRadius: 6, gap: 8 }]}>
        <View style={s.workingRow}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {dots.map((v, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.accent,
                  opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
                }}
              />
            ))}
          </View>
          <Text style={{ color: t.textDim, fontSize: 15 }}>{PHASE_LABEL[phase] || 'Working…'}</Text>
        </View>
        {/* Skeleton lines hint that an answer is coming */}
        {phase === 'thinking' || phase === 'loading' ? (
          <View style={{ gap: 6 }}>
            <View style={[s.skel, { backgroundColor: t.border, width: 200 }]} />
            <View style={[s.skel, { backgroundColor: t.border, width: 140 }]} />
          </View>
        ) : null}
        {slow ? <Text style={{ color: t.textDim, fontSize: 12 }}>{slow}</Text> : null}
        {phase === 'thinking' ? (
          <Pressable onPress={() => runtime.stopThinking()} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Stop</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** The conversation UI. Lives inside the quick-chat popup (see ChatModal). */
export function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useApp();
  const { maxWidth: contentMax, gutter } = useLayout();
  const { messages, phase, error, send, newChat } = useAssistant();
  const quick = useQuickAdd();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const input = useRef<TextInput>(null);
  const busy = phase !== 'idle' && phase !== 'listening' && phase !== 'speaking';
  const listening = phase === 'listening';
  const hasText = text.trim().length > 0;
  const bubbleMax = Math.min(contentMax * 0.85, 560);

  const toEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated }));
  }, []);

  // Always land on the latest message, including when the keyboard opens.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => toEnd(true));
    return () => sub.remove();
  }, [toEnd]);
  useEffect(() => {
    toEnd(true);
  }, [messages.length, busy, toEnd]);

  const submit = () => {
    if (!hasText || busy) {
      return;
    }
    const v = text;
    setText('');
    send(v, settings.speakReplies);
  };

  const openAdd = (m: AddMode) => {
    setMenu(false);
    setTimeout(() => quick.open(m), 120);
  };

  const showEmpty = messages.length === 0 && !busy;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', paddingTop: insets.top }}>
      <View style={[s.header, { paddingHorizontal: gutter }]}>
        <Text style={[s.h1, { color: t.text }]}>Chat</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable
            onPress={() => update('speakReplies', !settings.speakReplies)}
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.speakReplies }}
            accessibilityLabel="Read replies aloud"
            hitSlop={10}>
            {settings.speakReplies ? (
              <SpeakerHigh size={24} color={t.accent} weight="fill" />
            ) : (
              <SpeakerSlash size={24} color={t.textDim} />
            )}
          </Pressable>
          <Pressable onPress={newChat} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: t.accent, fontWeight: '600' }}>New chat</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chat" hitSlop={10}>
            <X size={26} color={t.text} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={({ item }) => <Bubble m={item} maxWidth={bubbleMax} />}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingVertical: 12,
            flexGrow: 1,
            width: '100%',
            maxWidth: contentMax,
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => toEnd(false)}
          onLayout={() => toEnd(false)}
          ListEmptyComponent={
            showEmpty ? (
              <View style={s.empty}>
                <Logo size={84} />
                <Text style={{ color: t.text, fontSize: 20, fontWeight: '600' }}>Hi, I'm Alphadron</Text>
                <Text style={{ color: t.textDim, textAlign: 'center' }}>
                  Chat with me about anything, or ask me to remind you, add a task, or check your day. Try one:
                </Text>
                <View style={{ gap: 8, width: '100%', marginTop: 8 }}>
                  {SUGGESTIONS.map(x => (
                    <Pressable
                      key={x}
                      onPress={() => {
                        setText(x);
                        input.current?.focus();
                      }}
                      style={[s.suggest, { borderColor: t.border, backgroundColor: t.surface }]}>
                      <Text style={{ color: t.text }}>{x}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {busy ? <WorkingBubble maxWidth={bubbleMax} /> : null}
              {error ? (
                <View style={[s.bubble, { backgroundColor: t.surface, borderColor: t.danger, borderWidth: 1, maxWidth: bubbleMax }]}>
                  <Text style={{ color: t.danger }}>{error}</Text>
                </View>
              ) : null}
            </>
          }
        />

        <View style={[s.barWrap, { borderTopColor: t.border, backgroundColor: t.tabBar, paddingBottom: 8 + insets.bottom }]}>
          <View style={[s.bar, { maxWidth: contentMax, paddingHorizontal: gutter - 6 }]}>
            {listening ? (
              <RecordingBar />
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setMenu(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="More actions"
                  style={[s.round, { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 }]}>
                  <Plus size={22} color={t.accent} weight="bold" />
                </Pressable>

                <TextInput
                  ref={input}
                  value={text}
                  onChangeText={setText}
                  placeholder="Message Alphadron"
                  placeholderTextColor={t.textDim}
                  style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
                  multiline
                  submitBehavior="newline"
                  textAlignVertical="center"
                  editable={!busy}
                />

                {hasText ? (
                  <Pressable
                    onPress={submit}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                    style={[s.round, { overflow: 'hidden', opacity: busy ? 0.4 : 1 }]}>
                    <AccentFill style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowUp size={22} color={t.onAccent} weight="bold" />
                    </AccentFill>
                  </Pressable>
                ) : (
                  <TalkButton size={44} compact />
                )}
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Quick add">
        <Row wrap gap={10}>
          <Chip label="Reminder" icon={<Bell size={18} color={t.accent} />} onPress={() => openAdd('reminder')} />
          <Chip label="Task" icon={<CheckSquare size={18} color={t.accent} />} onPress={() => openAdd('task')} />
          <Chip label="Event" icon={<CalendarBlank size={18} color={t.accent} />} onPress={() => openAdd('event')} />
          <Chip label="Note" icon={<Note size={18} color={t.accent} />} onPress={() => openAdd('note')} />
        </Row>
        <Chip
          label="Start a new chat"
          onPress={() => {
            setMenu(false);
            newChat();
          }}
        />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  h1: { fontSize: 28, fontWeight: '700' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 6 },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skel: { height: 10, borderRadius: 5, opacity: 0.6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 24 },
  suggest: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  barWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, alignItems: 'center' },
  bar: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
});
