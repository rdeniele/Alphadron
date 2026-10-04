import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModelsPanel } from '../models/ModelsPanel';
import { Button } from '../../components/ui';
import { useTheme, type ThemeMode } from '../../theme';
import { useApp } from '../../services/AppState';
import { useOnline } from '../../services/useOnline';
import { confirmAction } from '../../core/permissions/confirm';
import { getPreference, setPreference } from '../../database/repositories/settingsRepo';
import { clearAllConversations } from '../../database/repositories/conversationsRepo';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function SettingsScreen() {
  const t = useTheme();
  const online = useOnline();
  const { settings, update } = useApp();
  const [name, setName] = useState('');

  useEffect(() => {
    getPreference('user_name').then(v => setName(v ?? ''));
  }, []);

  const clearChats = async () => {
    if (await confirmAction('Delete all chat history? Tasks, reminders and memories are kept.', 'Delete')) {
      await clearAllConversations();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[s.h1, { color: t.text }]}>Settings</Text>

        <Text style={[s.h2, { color: t.textDim }]}>About you</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => setPreference('user_name', name)}
          placeholder="Your name (optional)"
          placeholderTextColor={t.textDim}
          style={[s.input, { color: t.text, borderColor: t.border }]}
        />

        <Text style={[s.h2, { color: t.textDim }]}>Appearance</Text>
        <View style={s.row}>
          {MODES.map(m => (
            <Pressable
              key={m}
              onPress={() => update('theme', m)}
              style={[
                s.chip,
                { borderColor: t.border, backgroundColor: settings.theme === m ? t.accent : t.surface },
              ]}>
              <Text style={{ color: settings.theme === m ? t.onAccent : t.text }}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[s.h2, { color: t.textDim }]}>Memory & privacy</Text>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: t.text }}>Remember things I ask it to</Text>
          <Switch value={settings.memoryEnabled} onValueChange={v => update('memoryEnabled', v)} />
        </View>
        <Text style={{ color: t.textDim, fontSize: 13 }}>
          Everything stays on this phone. Chats, tasks, reminders, notes and memories are never sent anywhere.
          The microphone is only used while you hold the talk button.
        </Text>
        <Button label="Clear chat history" kind="danger" onPress={clearChats} />

        <Text style={[s.h2, { color: t.textDim }]}>Status</Text>
        <Text style={{ color: t.text }}>
          {online ? 'Online (not required)' : 'Offline — everything still works'}
        </Text>

        <Text style={[s.h2, { color: t.textDim }]}>AI models</Text>
        <ModelsPanel />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
});
