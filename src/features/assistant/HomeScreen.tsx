import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, ChatCircleText, CircleDashed, Plus, WarningCircle } from 'phosphor-react-native';
import { TalkButton } from './TalkButton';
import { useAssistant } from './AssistantProvider';
import { useQuickAdd } from '../common/QuickAdd';
import { Card, Chip, Empty, Row, Screen, SectionTitle, fmtTime, useLayout } from '../../components/ui';
import { useTheme } from '../../theme';
import { useData } from '../../services/useData';
import * as tasks from '../../database/repositories/tasksRepo';
import { listReminders } from '../../database/repositories/remindersRepo';
import { listEvents } from '../../database/repositories/eventsRepo';
import { getPreference } from '../../database/repositories/settingsRepo';
import { endOfLocalDay, startOfLocalDay } from '../../core/scheduling/dateParse';

type Kind = 'reminder' | 'event' | 'task';
type Filter = 'all' | 'tasks' | 'reminders' | 'schedule';

interface Item {
  key: string;
  kind: Kind;
  title: string;
  at: number | null;
  overdue?: boolean;
  past?: boolean;
  task?: tasks.Task;
}

interface Today {
  overdue: Item[];
  timed: Item[];
  due: Item[];
  tomorrow: { count: number; titles: string[] };
  next: { title: string; at: number; kind: Kind } | null;
}

const EMPTY: Today = { overdue: [], timed: [], due: [], tomorrow: { count: 0, titles: [] }, next: null };

async function loadToday(): Promise<Today> {
  const now = new Date();
  const startToday = startOfLocalDay(now);
  const endToday = endOfLocalDay(now);
  const endTomorrow = endToday + 86400000;
  const nowMs = now.getTime();

  const [openDue, rems, evs, remsTomorrow, evsTomorrow, upcomingRems, upcomingEvs] = await Promise.all([
    tasks.listTasks({ status: 'open', dueBefore: endTomorrow }),
    listReminders({ from: startToday, to: endToday }),
    listEvents(startToday, endToday),
    listReminders({ from: endToday + 1, to: endTomorrow }),
    listEvents(endToday + 1, endTomorrow),
    listReminders({ from: nowMs, to: nowMs + 7 * 86400000 }),
    listEvents(nowMs, nowMs + 7 * 86400000),
  ]);

  const overdue: Item[] = openDue
    .filter(x => x.dueAt !== null && x.dueAt < startToday)
    .map(x => ({ key: `t${x.id}`, kind: 'task', title: x.title, at: x.dueAt, overdue: true, task: x }));
  const due: Item[] = openDue
    .filter(x => x.dueAt !== null && x.dueAt >= startToday && x.dueAt <= endToday)
    .map(x => ({ key: `t${x.id}`, kind: 'task', title: x.title, at: x.dueAt, task: x }));
  const timed: Item[] = [
    ...rems.map<Item>(r => ({ key: `r${r.id}`, kind: 'reminder', title: r.title, at: r.triggerAt, past: r.triggerAt < nowMs })),
    ...evs.map<Item>(e => ({ key: `e${e.id}`, kind: 'event', title: e.title, at: e.startsAt, past: e.startsAt < nowMs })),
  ].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  const tomorrowTitles = [
    ...remsTomorrow.map(r => ({ at: r.triggerAt, t: `${fmtTime(r.triggerAt)} ${r.title}` })),
    ...evsTomorrow.map(e => ({ at: e.startsAt, t: `${fmtTime(e.startsAt)} ${e.title}` })),
    ...openDue
      .filter(x => x.dueAt !== null && x.dueAt > endToday && x.dueAt <= endTomorrow)
      .map(x => ({ at: x.dueAt!, t: x.title })),
  ].sort((a, b) => a.at - b.at);

  const upcoming = [
    ...upcomingRems.map(r => ({ title: r.title, at: r.triggerAt, kind: 'reminder' as Kind })),
    ...upcomingEvs.map(e => ({ title: e.title, at: e.startsAt, kind: 'event' as Kind })),
  ].sort((a, b) => a.at - b.at);

  return {
    overdue,
    timed,
    due,
    tomorrow: { count: tomorrowTitles.length, titles: tomorrowTitles.slice(0, 3).map(x => x.t) },
    next: upcoming[0] ?? null,
  };
}

function untilText(at: number): string {
  const mins = Math.max(0, Math.round((at - Date.now()) / 60000));
  if (mins < 1) {
    return 'now';
  }
  if (mins < 60) {
    return `in ${mins} min`;
  }
  const h = Math.floor(mins / 60);
  if (h < 24) {
    const m = mins % 60;
    return `in ${h}h${m ? ` ${m}m` : ''}`;
  }
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${g}, ${name}` : g;
}

export function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation<{ navigate: (name: string) => void }>();
  const { error, refresh } = useAssistant();
  const quick = useQuickAdd();
  const [data, reload] = useData(loadToday, EMPTY);
  const [filter, setFilter] = useState<Filter>('all');
  const [name, setName] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    getPreference('user_name').then(setName);
    const id = setInterval(() => tick(x => x + 1), 30000); // keeps "in 5 min" fresh
    return () => clearInterval(id);
  }, []);

  const count = {
    tasks: data.overdue.length + data.due.length,
    reminders: data.timed.filter(i => i.kind === 'reminder').length,
    schedule: data.timed.filter(i => i.kind === 'event').length,
  };
  const total = count.tasks + count.reminders + count.schedule;

  const show = (k: Kind) =>
    filter === 'all' || (filter === 'tasks' && k === 'task') || (filter === 'reminders' && k === 'reminder') || (filter === 'schedule' && k === 'event');

  const complete = async (x: tasks.Task) => {
    await tasks.completeTask(x.id);
    await reload();
    refresh();
  };

  const row = (i: Item) => (
    <Card key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: i.past ? 0.55 : 1 }}>
      {i.task ? (
        <Pressable onPress={() => complete(i.task!)} hitSlop={10} accessibilityLabel={`Mark ${i.title} done`}>
          {i.overdue ? <WarningCircle size={26} color={t.danger} weight="fill" /> : <CircleDashed size={26} color={t.textDim} />}
        </Pressable>
      ) : (
        <Text style={{ color: t.accent, fontWeight: '700', width: 72 }}>{i.at ? fmtTime(i.at) : ''}</Text>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{i.title}</Text>
        <Text style={{ color: i.overdue ? t.danger : t.textDim, fontSize: 12 }}>
          {i.task ? (i.overdue ? 'Overdue' : 'Due today') : i.kind === 'reminder' ? 'Reminder' : 'Event'}
        </Text>
      </View>
      {i.task ? <Check size={18} color={t.textDim} /> : null}
    </Card>
  );

  const overdue = data.overdue.filter(i => show('task'));
  const timed = data.timed.filter(i => show(i.kind));
  const due = data.due.filter(i => show('task'));

  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const dock = (
    <View style={{ backgroundColor: t.surface, borderTopColor: t.border, borderTopWidth: 1 }}>
      <HomeDock
        onAdd={() => quick.open('reminder')}
        onChat={() => nav.navigate('Chat')}
        error={error}
      />
    </View>
  );

  return (
    <Screen footer={dock}>
      <Text style={{ color: t.text, fontSize: 26, fontWeight: '700' }}>{greeting(name)}</Text>
      <Text style={{ color: t.textDim, fontSize: 15, marginBottom: 4 }}>{dateLine}</Text>

      {data.next ? (
        <Card style={{ borderColor: t.accent, gap: 2 }}>
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            Up next · {untilText(data.next.at)}
          </Text>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>{data.next.title}</Text>
          <Text style={{ color: t.textDim, fontSize: 13 }}>
            {fmtTime(data.next.at)} · {data.next.kind === 'reminder' ? 'Reminder' : 'Event'}
          </Text>
        </Card>
      ) : null}

      <Row wrap gap={8}>
        <Chip label={`All ${total}`} active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Tasks ${count.tasks}`} active={filter === 'tasks'} onPress={() => setFilter('tasks')} />
        <Chip label={`Reminders ${count.reminders}`} active={filter === 'reminders'} onPress={() => setFilter('reminders')} />
        <Chip label={`Schedule ${count.schedule}`} active={filter === 'schedule'} onPress={() => setFilter('schedule')} />
      </Row>

      {overdue.length ? (
        <>
          <SectionTitle>Overdue</SectionTitle>
          {overdue.map(row)}
        </>
      ) : null}
      {timed.length ? (
        <>
          <SectionTitle>Today</SectionTitle>
          {timed.map(row)}
        </>
      ) : null}
      {due.length ? (
        <>
          <SectionTitle>Tasks due today</SectionTitle>
          {due.map(row)}
        </>
      ) : null}
      {!overdue.length && !timed.length && !due.length ? (
        <Empty text={filter === 'all' ? 'Nothing planned for today. Tap + or hold the mic to add something.' : 'Nothing here today.'} />
      ) : null}

      {data.tomorrow.count ? (
        <>
          <SectionTitle>Tomorrow</SectionTitle>
          <Pressable onPress={() => nav.navigate('Plan')} accessibilityRole="button">
            <Card>
              <Text style={{ color: t.text, fontWeight: '600' }}>
                {data.tomorrow.count} thing{data.tomorrow.count === 1 ? '' : 's'} planned
              </Text>
              {data.tomorrow.titles.map(x => (
                <Text key={x} style={{ color: t.textDim }}>• {x}</Text>
              ))}
            </Card>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

/** Bottom dock in the thumb zone: Add (left) · big mic (center) · Chat (right). */
function HomeDock({ onAdd, onChat, error }: { onAdd: () => void; onChat: () => void; error: string | null }) {
  const t = useTheme();
  const { maxWidth } = useLayout();
  return (
    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 10 }}>
      {error ? <Text style={{ color: t.danger, textAlign: 'center', paddingHorizontal: 20, marginBottom: 6 }}>{error}</Text> : null}
      <View style={{ width: '100%', maxWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 12 }}>
        <DockButton label="Add" onPress={onAdd}>
          <Plus size={26} color={t.accent} weight="bold" />
        </DockButton>
        <TalkButton size={76} />
        <DockButton label="Chat" onPress={onChat}>
          <ChatCircleText size={26} color={t.accent} />
        </DockButton>
      </View>
    </View>
  );
}

function DockButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 4, width: 72 }}>
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {children}
      </View>
      <Text style={{ color: t.textDim, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
