import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TalkButton } from './TalkButton';
import { useAssistant } from './AssistantProvider';
import { Card, Empty, SectionTitle, fmtDay, fmtTime } from '../../components/ui';
import { useTheme } from '../../theme';
import { useData } from '../../services/useData';
import { listTasks } from '../../database/repositories/tasksRepo';
import { listReminders } from '../../database/repositories/remindersRepo';
import { listEvents } from '../../database/repositories/eventsRepo';
import { recentActivity } from '../../database/repositories/conversationsRepo';
import { endOfLocalDay } from '../../core/scheduling/dateParse';

async function loadToday() {
  const now = new Date();
  const to = endOfLocalDay(now);
  const [tasks, reminders, events, activity] = await Promise.all([
    listTasks({ status: 'open', dueBefore: to }),
    listReminders({ from: Date.now() - 3600000, to }),
    listEvents(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), to),
    recentActivity(5),
  ]);
  return { tasks, reminders, events, activity };
}

export function HomeScreen() {
  const t = useTheme();
  const { error } = useAssistant();
  const [today] = useData(loadToday, { tasks: [], reminders: [], events: [], activity: [] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[s.h1, { color: t.text }]}>Alphadex</Text>
        <Text style={{ color: t.textDim, fontSize: 18 }}>How can I help?</Text>

        <View style={{ marginVertical: 24 }}>
          <TalkButton />
        </View>
        {error ? <Text style={{ color: t.danger, textAlign: 'center' }}>{error}</Text> : null}

        <SectionTitle>Today</SectionTitle>
        <Card>
          <Text style={{ color: t.text, fontWeight: '600' }}>Tasks</Text>
          {today.tasks.length ? (
            today.tasks.slice(0, 4).map(x => (
              <Text key={x.id} style={{ color: t.text }}>• {x.title}</Text>
            ))
          ) : (
            <Empty text="Nothing due today" />
          )}
        </Card>
        <Card>
          <Text style={{ color: t.text, fontWeight: '600' }}>Reminders</Text>
          {today.reminders.length ? (
            today.reminders.slice(0, 4).map(x => (
              <Text key={x.id} style={{ color: t.text }}>
                • {fmtTime(x.triggerAt)} — {x.title}
              </Text>
            ))
          ) : (
            <Empty text="No reminders today" />
          )}
        </Card>
        <Card>
          <Text style={{ color: t.text, fontWeight: '600' }}>Schedule</Text>
          {today.events.length ? (
            today.events.slice(0, 4).map(x => (
              <Text key={x.id} style={{ color: t.text }}>
                • {fmtTime(x.startsAt)} — {x.title}
              </Text>
            ))
          ) : (
            <Empty text="Nothing scheduled" />
          )}
        </Card>

        <SectionTitle>Recent activity</SectionTitle>
        {today.activity.length ? (
          today.activity.map(a => (
            <Text key={a.id} style={{ color: t.textDim, paddingVertical: 2 }}>
              {fmtDay(a.createdAt)} {fmtTime(a.createdAt)} · {a.action}
            </Text>
          ))
        ) : (
          <Empty text="No activity yet" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 8 },
  h1: { fontSize: 32, fontWeight: '700' },
});
