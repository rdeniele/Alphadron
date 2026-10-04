import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModelsPanel } from '../models/ModelsPanel';
import { useTheme, type ThemeMode } from '../../theme';
import { useApp } from '../../services/AppState';
import { useOnline } from '../../services/useOnline';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function SettingsScreen() {
  const t = useTheme();
  const online = useOnline();
  const { settings, update } = useApp();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[s.h1, { color: t.text }]}>Settings</Text>

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

        <Text style={[s.h2, { color: t.textDim }]}>Memory</Text>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: t.text }}>Remember things I ask it to</Text>
          <Switch value={settings.memoryEnabled} onValueChange={v => update('memoryEnabled', v)} />
        </View>

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
});
