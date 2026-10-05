import React, { useEffect, useState } from 'react';
import { Switch, Text, TextInput } from 'react-native';
import { ModelsPanel } from '../models/ModelsPanel';
import { Button, Card, Chip, Row, Screen, SectionTitle, Title } from '../../components/ui';
import { useTheme, type ThemeMode } from '../../theme';
import { useApp } from '../../services/AppState';
import { useOnline } from '../../services/useOnline';
import { useAssistant } from '../assistant/AssistantProvider';
import { confirmAction } from '../../core/permissions/confirm';
import { getPreference, setPreference } from '../../database/repositories/settingsRepo';
import { clearAllConversations } from '../../database/repositories/conversationsRepo';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function SettingsScreen() {
  const t = useTheme();
  const online = useOnline();
  const { settings, update } = useApp();
  const { reload } = useAssistant();
  const [name, setName] = useState('');

  useEffect(() => {
    getPreference('user_name').then(v => setName(v ?? ''));
  }, []);

  const clearChats = async () => {
    if (await confirmAction('Delete all chat history? Tasks, reminders and memories are kept.', 'Delete')) {
      await clearAllConversations();
      await reload();
    }
  };

  return (
    <Screen>
      <Title>Settings</Title>

      <SectionTitle>About you</SectionTitle>
      <TextInput
        value={name}
        onChangeText={setName}
        onEndEditing={() => setPreference('user_name', name)}
        placeholder="Your name (optional)"
        placeholderTextColor={t.textDim}
        style={{ color: t.text, fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 14 }}
      />

      <SectionTitle>Appearance</SectionTitle>
      <Row wrap>
        {MODES.map(m => (
          <Chip key={m} label={m[0].toUpperCase() + m.slice(1)} active={settings.theme === m} onPress={() => update('theme', m)} />
        ))}
      </Row>

      <SectionTitle>Memory & privacy</SectionTitle>
      <Card>
        <Row gap={12}>
          <Text style={{ color: t.text, flex: 1, fontSize: 16 }}>Remember things I ask it to</Text>
          <Switch value={settings.memoryEnabled} onValueChange={v => update('memoryEnabled', v)} />
        </Row>
        <Text style={{ color: t.textDim, fontSize: 13, marginTop: 6 }}>
          Everything stays on this phone. Chats, tasks, reminders, notes and memories are never sent anywhere. The microphone is only used while you hold the talk button.
        </Text>
      </Card>
      <Button label="Clear chat history" kind="danger" onPress={clearChats} />

      <SectionTitle>Status</SectionTitle>
      <Text style={{ color: t.text }}>{online ? 'Online (not required)' : 'Offline — everything still works'}</Text>

      <SectionTitle>AI models</SectionTitle>
      <ModelsPanel />
    </Screen>
  );
}
