import React, { useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { PencilSimple, Trash } from 'phosphor-react-native';
import { Button, Card, Chip, Empty, Fab, Row, Screen, Title, fmtDay, fmtTime } from '../../components/ui';
import { useTheme } from '../../theme';
import { useData } from '../../services/useData';
import { useApp } from '../../services/AppState';
import { useAssistant } from '../assistant/AssistantProvider';
import { useQuickAdd } from '../common/QuickAdd';
import { useItemDetail } from '../common/ItemDetail';
import { confirmAction } from '../../core/permissions/confirm';
import * as memories from '../../database/repositories/memoriesRepo';
import * as notes from '../../database/repositories/notesRepo';

type Tab = 'notes' | 'memory';

export function MemoryScreen() {
  const t = useTheme();
  const { settings, update } = useApp();
  const { refresh } = useAssistant();
  const quick = useQuickAdd();
  const detail = useItemDetail();
  const [tab, setTab] = useState<Tab>('notes');
  const [query, setQuery] = useState('');
  const [noteList, reloadNotes] = useData(() => notes.listNotes(200), [] as notes.Note[]);
  const [memList, reloadMems] = useData(memories.listMemories, [] as memories.Memory[]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const q = query.trim().toLowerCase();
  const shownNotes = q ? noteList.filter(n => (n.title ?? '').toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) : noteList;

  const clearMemories = async () => {
    if (await confirmAction(`Delete all ${memList.length} memories? This cannot be undone.`, 'Delete')) {
      await memories.clearMemories();
      reloadMems();
    }
  };

  return (
    <>
      <Screen>
        <Title>Notes</Title>
        <Row wrap>
          <Chip label="Notes" active={tab === 'notes'} onPress={() => setTab('notes')} />
          <Chip label="Memory" active={tab === 'memory'} onPress={() => setTab('memory')} />
        </Row>

        {tab === 'notes' && (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes"
              placeholderTextColor={t.textDim}
              style={{ color: t.text, fontSize: 16, minHeight: 46, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 14, paddingHorizontal: 14 }}
            />
            {shownNotes.length ? (
              shownNotes.map(n => (
                <Card key={n.id}>
                  <Pressable onPress={() => detail.open('note', n.id)} accessibilityLabel="Open note">
                    {n.title ? <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{n.title}</Text> : null}
                    <Text numberOfLines={6} style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>{n.body}</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ color: t.textDim, fontSize: 12 }}>
                      {fmtDay(n.updatedAt)} {fmtTime(n.updatedAt)}
                    </Text>
                    <Pressable onPress={() => detail.open('note', n.id)} hitSlop={10} accessibilityLabel="Edit note">
                      <PencilSimple size={20} color={t.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Delete this note?', n.body.slice(0, 80), [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => notes.deleteNote(n.id).then(() => { reloadNotes(); refresh(); }) },
                        ])
                      }
                      hitSlop={10}
                      accessibilityLabel="Delete note">
                      <Trash size={20} color={t.danger} />
                    </Pressable>
                  </View>
                </Card>
              ))
            ) : (
              <Empty text={q ? 'No notes match your search.' : 'No notes yet. Tap + to write one, or say "Note: …" in chat.'} />
            )}
          </>
        )}

        {tab === 'memory' && (
          <>
            <Text style={{ color: t.textDim }}>
              Only things you ask Alphadron to remember are saved here. Chats are not turned into memories.
            </Text>
            <Row gap={12}>
              <Text style={{ color: t.text, flex: 1, fontSize: 16 }}>Memory enabled</Text>
              <Switch value={settings.memoryEnabled} onValueChange={v => update('memoryEnabled', v)} />
            </Row>
            <Card>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add a memory, for example: My birthday is March 3"
                placeholderTextColor={t.textDim}
                style={{ color: t.text, fontSize: 16, minHeight: 46, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 }}
              />
              <Button
                label="Save memory"
                disabled={!draft.trim()}
                onPress={async () => {
                  await memories.addMemory({ content: draft.trim() });
                  setDraft('');
                  reloadMems();
                }}
              />
            </Card>
            {memList.length ? (
              memList.map(m => (
                <Card key={m.id}>
                  {editing === m.id ? (
                    <>
                      <TextInput
                        value={editText}
                        onChangeText={setEditText}
                        multiline
                        style={{ color: t.text, fontSize: 16, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}
                      />
                      <Row>
                        <Button
                          label="Save"
                          flex
                          disabled={!editText.trim()}
                          onPress={async () => {
                            await memories.updateMemory(m.id, editText.trim());
                            setEditing(null);
                            reloadMems();
                          }}
                        />
                        <Button label="Cancel" kind="ghost" flex onPress={() => setEditing(null)} />
                      </Row>
                    </>
                  ) : (
                    <Row gap={14}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontSize: 16 }}>{m.content}</Text>
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
                            { text: 'Delete', style: 'destructive', onPress: () => memories.deleteMemory(m.id).then(reloadMems) },
                          ])
                        }
                        accessibilityLabel="Delete memory"
                        hitSlop={10}>
                        <Trash size={20} color={t.danger} />
                      </Pressable>
                    </Row>
                  )}
                </Card>
              ))
            ) : (
              <Empty text={'No memories yet. Try saying: "Remember that I prefer morning meetings."'} />
            )}
            {memList.length ? <Button label="Clear all memories" kind="danger" onPress={clearMemories} /> : null}
          </>
        )}
      </Screen>
      {tab === 'notes' ? <Fab onPress={() => quick.open('note')} label="Add note" /> : null}
    </>
  );
}
