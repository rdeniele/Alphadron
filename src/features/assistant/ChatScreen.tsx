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
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUp,
  Bell,
  CalendarBlank,
  CheckCircle,
  CheckSquare,
  Note,
  Plus,
  Sparkle,
  WarningCircle,
} from 'phosphor-react-native';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { TalkButton } from './TalkButton';
import { useQuickAdd, type AddMode } from '../common/QuickAdd';
import { Chip, Row, Sheet, useLayout } from '../../components/ui';
import { useTheme } from '../../theme';
import { runtime } from '../../core/runtime';
import type { ChatMessage } from '../../database/repositories/conversationsRepo';

const SUGGESTIONS = [
  'Remind me tomorrow at 9 AM to work on my project',
  'What do I have tomorrow?',
  'Add task: finish proposal by friday',
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
      <View
        style={[
          s.bubble,
          {
            maxWidth,
            backgroundColor: mine ? t.accent : t.surface,
            borderColor: t.border,
            borderWidth: mine ? 0 : 1,
            borderBottomRightRadius: mine ? 6 : 18,
            borderBottomLeftRadius: mine ? 18 : 6,
          },
        ]}>
        <Text selectable style={{ color: mine ? t.onAccent : t.text, fontSize: 16, lineHeight: 23 }}>
          {m.content}
        </Text>
      </View>
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

  const slow = phase === 'loading' ? 'First answer takes a little longer while the AI loads' : secs >= 6 ? 'Still working…' : '';
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

export function ChatScreen() {
  const t = useTheme();
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
    send(v, false);
  };

  const openAdd = (m: AddMode) => {
    setMenu(false);
    setTimeout(() => quick.open(m), 120);
  };

  const showEmpty = messages.length === 0 && !busy;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={[s.header, { paddingHorizontal: gutter }]}>
        <Text style={[s.h1, { color: t.text }]}>Chat</Text>
        <Pressable onPress={newChat} accessibilityRole="button" hitSlop={10}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>New chat</Text>
        </Pressable>
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
                <Sparkle size={36} color={t.accent} weight="fill" />
                <Text style={{ color: t.text, fontSize: 20, fontWeight: '600' }}>How can I help?</Text>
                <Text style={{ color: t.textDim, textAlign: 'center' }}>Tap an example or type your own.</Text>
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

        <View style={[s.barWrap, { borderTopColor: t.border, backgroundColor: t.bg }]}>
          <View style={[s.bar, { maxWidth: contentMax, paddingHorizontal: gutter - 6 }]}>
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

            {listening ? (
              <View style={[s.input, { borderColor: t.danger, backgroundColor: t.surface, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.danger }} />
                <Text style={{ color: t.danger, fontWeight: '600' }}>Listening… release to send</Text>
              </View>
            ) : (
              <TextInput
                ref={input}
                value={text}
                onChangeText={setText}
                placeholder="Message Alphadex"
                placeholderTextColor={t.textDim}
                style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
                multiline
                submitBehavior="newline"
                textAlignVertical="center"
                editable={!busy}
              />
            )}

            {hasText && !listening ? (
              <Pressable
                onPress={submit}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={[s.round, { backgroundColor: t.accent, opacity: busy ? 0.4 : 1 }]}>
                <ArrowUp size={22} color={t.onAccent} weight="bold" />
              </Pressable>
            ) : (
              <TalkButton size={44} compact />
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
    </SafeAreaView>
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
