import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PencilSimple, Trash } from 'phosphor-react-native';
import { Button, Card, Empty } from '../../components/ui';
import { useTheme } from '../../theme';
import { useData } from '../../services/useData';
import { useApp } from '../../services/AppState';
import { confirmAction } from '../../core/permissions/confirm';
import * as memories from '../../database/repositories/memoriesRepo';

export function MemoryScreen() {
  const t = useTheme();
  const { settings, update } = useApp();
  const [list, reload] = useData(memories.listMemories, [] as memories.Memory[]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const add = async () => {
    await memories.addMemory({ content: draft.trim() });
    setDraft('');
    reload();
  };

  const clear = async () => {
    const ok = await confirmAction(`Delete all ${list.length} memories? This cannot be undone.`, 'Delete');
    if (ok) {
      await memories.clearMemories();
      reload();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[s.h1, { color: t.text }]}>Memory</Text>
        <Text style={{ color: t.textDim }}>
          Only things you ask Alphadex to remember are saved here. Chats are not turned into memories.
        </Text>

        <View style={s.rowBetween}>
          <Text style={{ color: t.text }}>Memory enabled</Text>
          <Switch value={settings.memoryEnabled} onValueChange={v => update('memoryEnabled', v)} />
        </View>

        <Card>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a memory, e.g. My birthday is March 3"
            placeholderTextColor={t.textDim}
            style={[s.input, { color: t.text, borderColor: t.border }]}
          />
          <Button label="Save memory" onPress={add} disabled={!draft.trim()} />
        </Card>

        {list.length ? (
          list.map(m => (
            <Card key={m.id}>
              {editing === m.id ? (
                <>
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    style={[s.input, { color: t.text, borderColor: t.border }]}
                  />
                  <View style={s.row}>
                    <Button
                      label="Save"
                      onPress={async () => {
                        await memories.updateMemory(m.id, editText.trim());
                        setEditing(null);
                        reload();
                      }}
                      disabled={!editText.trim()}
                    />
                    <Button label="Cancel" kind="ghost" onPress={() => setEditing(null)} />
                  </View>
                </>
              ) : (
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text }}>{m.content}</Text>
                    {m.sensitive ? <Text style={{ color: t.textDim, fontSize: 12 }}>Marked sensitive</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditing(m.id);
                      setEditText(m.content);
                    }}
                    accessibilityLabel="Edit memory"
                    hitSlop={10}>
                    <PencilSimple size={20} color={t.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete this memory?', m.content, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => memories.deleteMemory(m.id).then(reload) },
                      ])
                    }
                    accessibilityLabel="Delete memory"
                    hitSlop={10}>
                    <Trash size={20} color={t.danger} />
                  </Pressable>
                </View>
              )}
            </Card>
          ))
        ) : (
          <Empty text="No memories yet. Try saying: “Remember that I prefer morning meetings.”" />
        )}

        {list.length ? <Button label="Clear all memories" kind="danger" onPress={clear} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 10 },
  h1: { fontSize: 28, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, marginBottom: 8 },
});
