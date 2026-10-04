import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Microphone } from 'phosphor-react-native';
import { useTheme } from '../../theme';

const SECTIONS = ['Tasks', 'Reminders', 'Schedule'];

export function HomeScreen() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[s.h1, { color: t.text }]}>Alphadex</Text>
        <Text style={{ color: t.textDim, fontSize: 18 }}>How can I help?</Text>

        <Pressable style={[s.mic, { backgroundColor: t.accent }]} disabled>
          <Microphone size={44} color={t.onAccent} weight="fill" />
        </Pressable>
        <Text style={{ color: t.textDim, textAlign: 'center' }}>
          Talk to Alphadex — available once the voice models are set up
        </Text>

        <Text style={[s.h2, { color: t.textDim }]}>Today</Text>
        {SECTIONS.map(name => (
          <View key={name} style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '600' }}>{name}</Text>
            <Text style={{ color: t.textDim }}>Nothing yet</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  h1: { fontSize: 32, fontWeight: '700' },
  h2: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 16 },
  mic: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    opacity: 0.6,
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
});
