import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, CalendarBlank, CheckSquare, Note, PencilSimpleLine } from 'phosphor-react-native';
import { TalkButton } from './TalkButton';
import { useAssistant } from './AssistantProvider';
import { useQuickAdd } from '../common/QuickAdd';
import { Card, Chip, Empty, Row, Screen, SectionTitle, fmtDay, fmtTime } from '../../components/ui';
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
  const nav = useNavigation<{ navigate: (name: string) => void }>();
  const { error } = useAssistant();
  const quick = useQuickAdd();
  const [today] = useData(loadToday, { tasks: [], reminders: [], events: [], activity: [] });

  return (
    <Screen>
      <Text style={{ color: t.text, fontSize: 32, fontWeight: '700' }}>Alphadex</Text>
      <Text style={{ color: t.textDim, fontSize: 18 }}>How can I help?</Text>

      <Pressable
        onPress={() => nav.navigate('Chat')}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.surface,
          borderRadius: 24,
          minHeight: 50,
          paddingHorizontal: 16,
          marginTop: 8,
        }}>
        <PencilSimpleLine size={20} color={t.textDim} />
        <Text style={{ color: t.textDim, fontSize: 16 }}>Ask or add something…</Text>
      </Pressable>

      <View style={{ marginVertical: 20, alignItems: 'center' }}>
        <TalkButton />
      </View>
      {error ? <Text style={{ color: t.danger, textAlign: 'center' }}>{error}</Text> : null}

      <Row wrap gap={8}>
        <Chip label="Reminder" icon={<Bell size={18} color={t.accent} />} onPress={() => quick.open('reminder')} />
        <Chip label="Task" icon={<CheckSquare size={18} color={t.accent} />} onPress={() => quick.open('task')} />
        <Chip label="Event" icon={<CalendarBlank size={18} color={t.accent} />} onPress={() => quick.open('event')} />
        <Chip label="Note" icon={<Note size={18} color={t.accent} />} onPress={() => quick.open('note')} />
      </Row>

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
    </Screen>
  );
}
