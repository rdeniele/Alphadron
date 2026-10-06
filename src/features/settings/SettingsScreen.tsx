import React, { useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ModelsPanel } from '../models/ModelsPanel';
import { Button, Card, Chip, Row, Screen, SectionTitle, Title } from '../../components/ui';
import { useTheme, type ThemeMode } from '../../theme';
import { useApp } from '../../services/AppState';
import { useOnline } from '../../services/useOnline';
import { useAssistant } from '../assistant/AssistantProvider';
import { confirmAction } from '../../core/permissions/confirm';
import { getPreference, setPreference } from '../../database/repositories/settingsRepo';
import { runtime } from '../../core/runtime';
import { MIC_OPTIONS } from '../../core/voice/micOptions';
import { MicTest } from './MicTest';
import { clearAllConversations } from '../../database/repositories/conversationsRepo';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

function Diagnostics() {
  const t = useTheme();
  const [, force] = useState(0);
  const st = runtime.provider.lastStats;
  return (
    <Card>
      <Text style={{ color: t.text, fontWeight: '600' }}>Last model reply</Text>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        {st
          ? `${st.tokensPerSecond} tokens/s · read ${st.promptTokens} prompt tokens in ${st.promptMs} ms (${st.cachedTokens} cached) · wrote ${st.genTokens} tokens in ${st.genMs} ms`
          : 'No model reply yet. Ask something open-ended in Chat.'}
      </Text>
      <Button label="Refresh" kind="ghost" onPress={() => force(x => x + 1)} />
    </Card>
  );
}

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

      <SectionTitle>Microphone</SectionTitle>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        If voice isn't recognized, try another source and run the test. Some phones only work with one of them.
      </Text>
      {MIC_OPTIONS.map(o => (
        <Pressable
          key={o.key}
          onPress={() => update('micSource', o.key)}
          accessibilityRole="radio"
          accessibilityState={{ selected: settings.micSource === o.key }}
          style={{
            borderWidth: 1,
            borderColor: settings.micSource === o.key ? t.accent : t.border,
            backgroundColor: t.surface,
            borderRadius: 14,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: settings.micSource === o.key ? t.accent : t.textDim,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {settings.micSource === o.key ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16 }}>{o.label}</Text>
            <Text style={{ color: t.textDim, fontSize: 12 }}>{o.hint}</Text>
          </View>
        </Pressable>
      ))}
      <MicTest />

      <SectionTitle>AI model for open-ended questions</SectionTitle>
      <Row wrap>
        <Chip label="Fast (0.6B)" active={settings.aiModel === 'qwen3_fast'} onPress={() => update('aiModel', 'qwen3_fast')} />
        <Chip label="Better quality (1.7B)" active={settings.aiModel === 'qwen3'} onPress={() => update('aiModel', 'qwen3')} />
      </Row>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        Reminders, tasks, notes and schedule questions never wait on the model. This only affects chat.
      </Text>
      <Diagnostics />

      <SectionTitle>AI models</SectionTitle>
      <ModelsPanel />
    </Screen>
  );
}
