import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, PaperPlaneRight, Plus, WarningCircle } from 'phosphor-react-native';
import { PHASE_LABEL, useAssistant } from './AssistantProvider';
import { TalkButton } from './TalkButton';
import { useTheme } from '../../theme';
import type { ChatMessage } from '../../database/repositories/conversationsRepo';

function Bubble({ m }: { m: ChatMessage }) {
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
          { backgroundColor: mine ? t.accent : t.surface, borderColor: t.border, borderWidth: mine ? 0 : 1 },
        ]}>
        <Text style={{ color: mine ? t.onAccent : t.text, fontSize: 16, lineHeight: 22 }}>{m.content}</Text>
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

export function ChatScreen() {
  const t = useTheme();
  const { messages, phase, error, send, newChat } = useAssistant();
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const busy = phase !== 'idle';

  useEffect(() => {
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length, phase]);

  const submit = () => {
    const v = text;
    setText('');
    send(v, false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.h1, { color: t.text }]}>Chat</Text>
        <Pressable onPress={newChat} accessibilityLabel="New chat" hitSlop={12}>
          <Plus size={24} color={t.accent} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={({ item }) => <Bubble m={item} />}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <Text style={{ color: t.textDim, textAlign: 'center', marginTop: 40 }}>
              Try: "Remind me tomorrow at 9 AM to work on my project."
            </Text>
          }
        />
        {busy ? <Text style={{ color: t.textDim, paddingHorizontal: 16 }}>{PHASE_LABEL[phase]}</Text> : null}
        {error ? <Text style={{ color: t.danger, paddingHorizontal: 16, paddingBottom: 4 }}>{error}</Text> : null}
        <View style={[s.inputRow, { borderTopColor: t.border, backgroundColor: t.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message Alphadex"
            placeholderTextColor={t.textDim}
            style={[s.input, { color: t.text, borderColor: t.border }]}
            editable={!busy}
            multiline
            onSubmitEditing={submit}
          />
          <Pressable
            onPress={submit}
            disabled={busy || !text.trim()}
            accessibilityLabel="Send"
            style={[s.send, { backgroundColor: t.accent, opacity: busy || !text.trim() ? 0.4 : 1 }]}>
            <PaperPlaneRight size={22} color={t.onAccent} weight="fill" />
          </Pressable>
          <TalkButton size={44} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  h1: { fontSize: 28, fontWeight: '700' },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
