import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, CircleDashed, Trash } from 'phosphor-react-native';
import { Button, Card, Empty, fmtDay, fmtTime } from '../../components/ui';
import { useTheme } from '../../theme';
import { useData } from '../../services/useData';
import { useAssistant } from '../assistant/AssistantProvider';
import { executeTool } from '../../core/tools/executor';
import { platform } from '../../platform';
import { confirmAction } from '../../core/permissions/confirm';
import { useApp } from '../../services/AppState';
import * as tasks from '../../database/repositories/tasksRepo';
import * as reminders from '../../database/repositories/remindersRepo';
import * as events from '../../database/repositories/eventsRepo';
import { cancelReminderNotification } from '../../core/reminders/scheduler';

type Tab = 'tasks' | 'reminders' | 'schedule';

export function PlanScreen() {
  const t = useTheme();
  const { settings } = useApp();
  const { reload: reloadChat } = useAssistant();
  const [tab, setTab] = useState<Tab>('tasks');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');

  const [taskList, reloadTasks] = useData(() => tasks.listTasks({ status: 'all' }), [] as tasks.Task[]);
  const [remList, reloadRems] = useData(
    () => reminders.listReminders({ from: Date.now() - 86400000 }),
    [] as reminders.Reminder[],
  );
  const [evList, reloadEvs] = useData(
    () => events.listEvents(Date.now() - 86400000, Date.now() + 90 * 86400000),
    [] as events.ScheduledEvent[],
  );

  const refresh = async () => {
    await Promise.all([reloadTasks(), reloadRems(), reloadEvs()]);
  };

  // Manual adds go through the same validated tool path as the AI.
  const add = async () => {
    setError('');
    const name = tab === 'tasks' ? 'create_task' : tab === 'reminders' ? 'create_reminder' : 'create_schedule';
    const args =
      tab === 'tasks'
        ? { title, due_date: when || undefined }
        : { title, when };
    const r = await executeTool(name, args, {
      now: new Date(),
      platform,
      memoryEnabled: settings.memoryEnabled,
      confirm: confirmAction,
    });
    if (!r.result.ok) {
      setError(r.result.summary);
      return;
    }
    setTitle('');
    setWhen('');
    await refresh();
    await reloadChat();
  };

  const tabs: Tab[] = ['tasks', 'reminders', 'schedule'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[s.h1, { color: t.text }]}>Plan</Text>
        <View style={s.row}>
          {tabs.map(k => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[s.chip, { borderColor: t.border, backgroundColor: tab === k ? t.accent : t.surface }]}>
              <Text style={{ color: tab === k ? t.onAccent : t.text, textTransform: 'capitalize' }}>{k}</Text>
            </Pressable>
          ))}
        </View>

        <Card>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={tab === 'tasks' ? 'New task' : tab === 'reminders' ? 'Remind me to…' : 'Event title'}
            placeholderTextColor={t.textDim}
            style={[s.input, { color: t.text, borderColor: t.border }]}
          />
          <TextInput
            value={when}
            onChangeText={setWhen}
            placeholder={tab === 'tasks' ? 'Due (optional): friday, 2026-10-05' : 'When: tomorrow at 9 AM'}
            placeholderTextColor={t.textDim}
            style={[s.input, { color: t.text, borderColor: t.border }]}
          />
          {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
          <Button label="Add" onPress={add} disabled={!title.trim() || (tab !== 'tasks' && !when.trim())} />
        </Card>

        {tab === 'tasks' &&
          (taskList.length ? (
            taskList.map(x => (
              <Card key={x.id} style={s.item}>
                <Pressable
                  onPress={async () => {
                    await (x.status === 'done' ? tasks.reopenTask(x.id) : tasks.completeTask(x.id));
                    refresh();
                  }}
                  accessibilityLabel={x.status === 'done' ? 'Mark not done' : 'Mark done'}>
                  {x.status === 'done' ? <Check size={24} color={t.ok} weight="bold" /> : <CircleDashed size={24} color={t.textDim} />}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, textDecorationLine: x.status === 'done' ? 'line-through' : 'none' }}>
                    {x.title}
                  </Text>
                  {x.dueAt ? (
                    <Text style={{ color: t.textDim, fontSize: 13 }}>
                      Due {fmtDay(x.dueAt)} {fmtTime(x.dueAt)}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => tasks.deleteTask(x.id).then(refresh)}
                  accessibilityLabel="Delete task"
                  hitSlop={10}>
                  <Trash size={20} color={t.danger} />
                </Pressable>
              </Card>
            ))
          ) : (
            <Empty text="No tasks yet" />
          ))}

        {tab === 'reminders' &&
          (remList.length ? (
            remList.map(x => (
              <Card key={x.id} style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text }}>{x.title}</Text>
                  <Text style={{ color: t.textDim, fontSize: 13 }}>
                    {fmtDay(x.triggerAt)} {fmtTime(x.triggerAt)}
                    {x.repeatRule ? ` · ${x.repeatRule}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    await reminders.deleteReminder(x.id);
                    await cancelReminderNotification(x.id);
                    refresh();
                  }}
                  accessibilityLabel="Delete reminder"
                  hitSlop={10}>
                  <Trash size={20} color={t.danger} />
                </Pressable>
              </Card>
            ))
          ) : (
            <Empty text="No upcoming reminders" />
          ))}

        {tab === 'schedule' &&
          (evList.length ? (
            evList.map(x => (
              <Card key={x.id} style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text }}>{x.title}</Text>
                  <Text style={{ color: t.textDim, fontSize: 13 }}>
                    {fmtDay(x.startsAt)} {fmtTime(x.startsAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete event?', x.title, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => events.deleteEvent(x.id).then(refresh) },
                    ])
                  }
                  accessibilityLabel="Delete event"
                  hitSlop={10}>
                  <Trash size={20} color={t.danger} />
                </Pressable>
              </Card>
            ))
          ) : (
            <Empty text="Nothing scheduled" />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 10 },
  h1: { fontSize: 28, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
