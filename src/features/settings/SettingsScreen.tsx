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
import { platform } from '../../platform';
import { MIC_OPTIONS, micLabel, type MicSetting } from '../../core/voice/micOptions';
import { MicTest } from './MicTest';
import { clearAllConversations } from '../../database/repositories/conversationsRepo';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

const MIC_CHOICES: { key: MicSetting; label: string; hint: string }[] = [
  { key: 'auto', label: 'Automatic (recommended)', hint: 'Finds a microphone that works on your phone.' },
  ...MIC_OPTIONS.map(o => ({ key: o.key as MicSetting, label: o.label, hint: o.hint })),
];

function Diagnostics() {
  const t = useTheme();
  const [, force] = useState(0);
  const st = runtime.provider.lastStats;
  return (
    <Card>
      <Text style={{ color: t.text, fontWeight: '600' }}>Last AI reply</Text>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        {st
          ? `${st.tokensPerSecond} tokens/s · read ${st.promptTokens} prompt tokens in ${st.promptMs} ms (${st.cachedTokens} cached) · wrote ${st.genTokens} tokens in ${st.genMs} ms`
          : 'No AI reply yet. Chat about something open-ended first.'}
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

  const [testNote, setTestNote] = useState('');
  const [channelInfo, setChannelInfo] = useState('');

  useEffect(() => {
    platform.notifications.setAlertPrefs({ sound: settings.alertSound, style: settings.alertStyle });
    platform.notifications.describeAlertChannel().then(setChannelInfo).catch(() => setChannelInfo(''));
  }, [settings.alertSound, settings.alertStyle]);

  const testAlert = async (afterSeconds: number) => {
    platform.notifications.setAlertPrefs({ sound: settings.alertSound, style: settings.alertStyle });
    if (await platform.notifications.ensurePermission()) {
      await platform.notifications.showNow('Alphadron', 'This is how your due alerts will sound.', afterSeconds);
      setTestNote(
        afterSeconds > 1
          ? 'Alert coming in 10 seconds. Lock your phone now and listen.'
          : 'Alert sent. You should hear the chime now.',
      );
    } else {
      await confirmAction('Notifications are turned off for Alphadron. Turn them on in Android settings to get alerts.', 'OK');
    }
  };

  const clearChats = async () => {
    if (await confirmAction('Delete all chat history? Your tasks, reminders, and memories will be kept.', 'Delete')) {
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

      <SectionTitle>Voice</SectionTitle>
      <Card>
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16 }}>Read replies aloud</Text>
            <Text style={{ color: t.textDim, fontSize: 12 }}>Replies to your voice are always spoken. Turn this on to hear typed chats too.</Text>
          </View>
          <Switch value={settings.speakReplies} onValueChange={v => update('speakReplies', v)} />
        </Row>
      </Card>

      <SectionTitle>Alerts</SectionTitle>
      <Card>
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16 }}>Chime when something is due</Text>
            <Text style={{ color: t.textDim, fontSize: 12 }}>
              One soft chime at the due time for reminders, events, and tasks. It never repeats or nags.
            </Text>
          </View>
          <Switch value={settings.alertSound} onValueChange={v => update('alertSound', v)} />
        </Row>
      </Card>
      {settings.alertSound ? (
        <Row wrap>
          <Chip label="Gentle" active={settings.alertStyle === 'gentle'} onPress={() => update('alertStyle', 'gentle')} />
          <Chip label="Alarm volume" active={settings.alertStyle === 'alarm'} onPress={() => update('alertStyle', 'alarm')} />
        </Row>
      ) : null}
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        {settings.alertStyle === 'alarm' && settings.alertSound
          ? 'Alarm volume plays at your alarm volume, even when the phone is on silent.'
          : 'Gentle follows your notification volume and respects silent mode.'}{' '}
        Tasks with only a date alert at 9:00 AM that day.
      </Text>
      <Card>
        <Text style={{ color: t.text, fontWeight: '700' }}>Test your alerts</Text>
        <Text style={{ color: t.textDim, fontSize: 13 }}>
          "Play now" sounds right away while the app is open. "In 10 seconds" is the real test: tap it, then lock your phone and listen.
        </Text>
        <Row wrap>
          <Button label="Play now" kind="ghost" onPress={() => testAlert(1)} />
          <Button label="In 10 seconds" kind="ghost" onPress={() => testAlert(10)} />
        </Row>
        {testNote ? <Text style={{ color: t.accent, fontSize: 13 }}>{testNote}</Text> : null}
        {channelInfo ? <Text style={{ color: t.textDim, fontSize: 12 }}>{channelInfo}</Text> : null}
        <Text style={{ color: t.textDim, fontSize: 12 }}>
          No sound? Make sure Do Not Disturb is off and the notification volume is up. You can also check the alert sound in Android's settings.
        </Text>
        <Row wrap>
          <Button label="Alert sound settings" kind="ghost" onPress={() => platform.notifications.openAlertSoundSettings()} />
          <Button label="Make alerts exact" kind="ghost" onPress={() => platform.notifications.openExactAlarmSettings()} />
        </Row>
        <Text style={{ color: t.textDim, fontSize: 12 }}>
          For alerts right on the minute, allow "Alarms and reminders" for Alphadron when Android asks.
        </Text>
      </Card>

      <SectionTitle>Microphone</SectionTitle>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        Phones differ in which microphone input works. Automatic switches by itself if one records silence
        {settings.micSource === 'auto' ? ` (now using: ${micLabel(runtime.stt.resolved).toLowerCase()})` : ''}.
      </Text>
      {MIC_CHOICES.map(o => (
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

      <SectionTitle>Memory & privacy</SectionTitle>
      <Card>
        <Row gap={12}>
          <Text style={{ color: t.text, flex: 1, fontSize: 16 }}>Let Alphadron remember things</Text>
          <Switch value={settings.memoryEnabled} onValueChange={v => update('memoryEnabled', v)} />
        </Row>
        <Text style={{ color: t.textDim, fontSize: 13, marginTop: 6 }}>
          Everything stays on this phone. Chats, tasks, reminders, notes, and memories are never sent anywhere. The microphone only records after you tap it.
        </Text>
      </Card>
      <Button label="Clear chat history" kind="danger" onPress={clearChats} />

      <SectionTitle>Offline AI (about 560 MB total)</SectionTitle>
      <Text style={{ color: t.textDim, fontSize: 13 }}>
        {online ? 'Online. This is only needed to download the models once.' : 'Offline. Everything still works.'}
      </Text>
      <ModelsPanel />
      <Diagnostics />
    </Screen>
  );
}
