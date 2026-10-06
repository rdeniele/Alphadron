import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { CaretLeft, CaretRight, Check, CircleDashed, Trash } from 'phosphor-react-native';
import { Card, Chip, Empty, Fab, Row, Screen, Title, fmtDay, fmtTime } from '../../components/ui';
import { useTheme } from '../../theme';
import { useData } from '../../services/useData';
import { useAssistant } from '../assistant/AssistantProvider';
import { useQuickAdd, type AddMode } from '../common/QuickAdd';
import * as tasks from '../../database/repositories/tasksRepo';
import * as reminders from '../../database/repositories/remindersRepo';
import * as events from '../../database/repositories/eventsRepo';
import { cancelReminderNotification } from '../../core/reminders/scheduler';
import { endOfLocalDay, isDateOnlyDue, startOfLocalDay } from '../../core/scheduling/dateParse';

type Tab = 'agenda' | 'tasks' | 'reminders' | 'schedule';
const TABS: { key: Tab; label: string }[] = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'schedule', label: 'Events' },
];
const ADD_MODE: Record<Tab, AddMode> = { agenda: 'reminder', tasks: 'task', reminders: 'reminder', schedule: 'event' };

interface AgendaItem {
  key: string;
  at: number | null;
  title: string;
  kind: 'reminder' | 'event' | 'task';
  task?: tasks.Task;
}

export function PlanScreen() {
  const t = useTheme();
  const { refresh } = useAssistant();
  const quick = useQuickAdd();
  const [tab, setTab] = useState<Tab>('agenda');
  const [dayOffset, setDayOffset] = useState(0);

  const dayStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return startOfLocalDay(d);
  })();

  const [taskList, reloadTasks] = useData(() => tasks.listTasks({ status: 'all' }), [] as tasks.Task[]);
  const [remList, reloadRems] = useData(
    () => reminders.listReminders({ from: Date.now() - 86400000 }),
    [] as reminders.Reminder[],
  );
  const [evList, reloadEvs] = useData(
    () => events.listEvents(Date.now() - 86400000, Date.now() + 365 * 86400000),
    [] as events.ScheduledEvent[],
  );

  const reloadAll = async () => {
    await Promise.all([reloadTasks(), reloadRems(), reloadEvs()]);
    refresh();
  };

  const agenda: AgendaItem[] = (() => {
    const end = endOfLocalDay(new Date(dayStart + 1));
    const timed: AgendaItem[] = [
      ...remList
        .filter(r => r.triggerAt >= dayStart && r.triggerAt <= end)
        .map(r => ({ key: `r${r.id}`, at: r.triggerAt, title: r.title, kind: 'reminder' as const })),
      ...evList
        .filter(e => e.startsAt >= dayStart && e.startsAt <= end)
        .map(e => ({ key: `e${e.id}`, at: e.startsAt, title: e.title, kind: 'event' as const })),
    ].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    const due: AgendaItem[] = taskList
      .filter(x => x.dueAt !== null && x.dueAt >= dayStart && x.dueAt <= end)
      .map(x => ({ key: `t${x.id}`, at: null, title: x.title, kind: 'task' as const, task: x }));
    return [...timed, ...due];
  })();

  const toggleTask = async (x: tasks.Task) => {
    await (x.status === 'done' ? tasks.reopenTask(x.id) : tasks.completeTask(x.id));
    reloadAll();
  };

  const confirmDelete = (label: string, run: () => Promise<void>) =>
    Alert.alert('Delete?', label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run().then(reloadAll) },
    ]);

  const TaskRow = ({ x }: { x: tasks.Task }) => (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => toggleTask(x)} hitSlop={10} accessibilityLabel={x.status === 'done' ? 'Mark not done' : 'Mark done'}>
        {x.status === 'done' ? <Check size={26} color={t.ok} weight="bold" /> : <CircleDashed size={26} color={t.textDim} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16, textDecorationLine: x.status === 'done' ? 'line-through' : 'none' }}>{x.title}</Text>
        {x.dueAt ? (
          <Text style={{ color: t.textDim, fontSize: 13 }}>
            Due {fmtDay(x.dueAt)}
            {isDateOnlyDue(x.dueAt) ? '' : ` ${fmtTime(x.dueAt)}`}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={() => confirmDelete(x.title, () => tasks.deleteTask(x.id))} hitSlop={10} accessibilityLabel="Delete task">
        <Trash size={20} color={t.danger} />
      </Pressable>
    </Card>
  );

  const dayLabel = fmtDay(dayStart + 1);
  const dayFull = new Date(dayStart + 1).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <Screen>
        <Title>Plan</Title>
        <Row wrap>
          {TABS.map(k => (
            <Chip key={k.key} label={k.label} active={tab === k.key} onPress={() => setTab(k.key)} />
          ))}
        </Row>

        {tab === 'agenda' && (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => setDayOffset(d => d - 1)} hitSlop={12} accessibilityLabel="Previous day">
                <CaretLeft size={24} color={t.accent} />
              </Pressable>
              <Pressable onPress={() => setDayOffset(0)} style={{ alignItems: 'center' }}>
                <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{dayLabel}</Text>
                <Text style={{ color: t.textDim, fontSize: 13 }}>{dayFull}</Text>
              </Pressable>
              <Pressable onPress={() => setDayOffset(d => d + 1)} hitSlop={12} accessibilityLabel="Next day">
                <CaretRight size={24} color={t.accent} />
              </Pressable>
            </Card>
            {agenda.length ? (
              agenda.map(i =>
                i.task ? (
                  <TaskRow key={i.key} x={i.task} />
                ) : (
                  <Card key={i.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Text style={{ color: t.accent, fontWeight: '700', width: 74 }}>{i.at ? fmtTime(i.at) : ''}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 16 }}>{i.title}</Text>
                      <Text style={{ color: t.textDim, fontSize: 12 }}>{i.kind === 'reminder' ? 'Reminder' : 'Event'}</Text>
                    </View>
                  </Card>
                ),
              )
            ) : (
              <Empty text={`Nothing planned for ${dayLabel.toLowerCase()}. Tap + to add something.`} />
            )}
          </>
        )}

        {tab === 'tasks' &&
          (taskList.length ? taskList.map(x => <TaskRow key={x.id} x={x} />) : <Empty text="No tasks yet. Tap + to add one." />)}

        {tab === 'reminders' &&
          (remList.length ? (
            remList.map(x => (
              <Card key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16 }}>{x.title}</Text>
                  <Text style={{ color: t.textDim, fontSize: 13 }}>
                    {fmtDay(x.triggerAt)} {fmtTime(x.triggerAt)}
                    {x.repeatRule ? ` · repeats ${x.repeatRule}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    confirmDelete(x.title, async () => {
                      await reminders.deleteReminder(x.id);
                      await cancelReminderNotification(x.id);
                    })
                  }
                  hitSlop={10}
                  accessibilityLabel="Delete reminder">
                  <Trash size={20} color={t.danger} />
                </Pressable>
              </Card>
            ))
          ) : (
            <Empty text="No upcoming reminders. Tap + to add one." />
          ))}

        {tab === 'schedule' &&
          (evList.length ? (
            evList.map(x => (
              <Card key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16 }}>{x.title}</Text>
                  <Text style={{ color: t.textDim, fontSize: 13 }}>
                    {fmtDay(x.startsAt)} {fmtTime(x.startsAt)}
                  </Text>
                </View>
                <Pressable onPress={() => confirmDelete(x.title, () => events.deleteEvent(x.id))} hitSlop={10} accessibilityLabel="Delete event">
                  <Trash size={20} color={t.danger} />
                </Pressable>
              </Card>
            ))
          ) : (
            <Empty text="Nothing scheduled. Tap + to add an event." />
          ))}
      </Screen>
      <Fab onPress={() => quick.open(ADD_MODE[tab])} label="Add" />
    </>
  );
}
