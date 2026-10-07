import React, { createContext, useCallback, useContext, useState } from 'react';
import { ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Button, Chip, Row, Sheet } from '../../components/ui';
import { DateTimeField } from '../../components/DateTimeField';
import { useTheme } from '../../theme';
import { confirmAction } from '../../core/permissions/confirm';
import { useAssistant } from '../assistant/AssistantProvider';
import { useQuickAdd } from './QuickAdd';
import * as tasks from '../../database/repositories/tasksRepo';
import * as reminders from '../../database/repositories/remindersRepo';
import * as events from '../../database/repositories/eventsRepo';
import * as notes from '../../database/repositories/notesRepo';
import {
  cancelEventAlert,
  cancelReminderNotification,
  cancelTaskAlert,
  scheduleEventAlert,
  scheduleReminder,
  syncTaskAlert,
} from '../../core/reminders/scheduler';
import { dateOnlyDue, isDateOnlyDue } from '../../core/scheduling/dateParse';

export type ItemKind = 'task' | 'reminder' | 'event' | 'note';

interface Ctx {
  open: (kind: ItemKind, id: number) => void;
}

const ItemDetailCtx = createContext<Ctx>({ open: () => undefined });
export const useItemDetail = () => useContext(ItemDetailCtx);

const TITLES: Record<ItemKind, string> = { task: 'Task', reminder: 'Reminder', event: 'Event', note: 'Note' };
const PRIORITIES = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Low' },
];

/** Tap-to-open detail modal: view, edit, complete and delete a task, reminder, event or note. */
export function ItemDetailProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { refresh } = useAssistant();
  const { toast } = useQuickAdd();
  const { height } = useWindowDimensions();

  const [kind, setKind] = useState<ItemKind>('task');
  const [id, setId] = useState(0);
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [dateOnly, setDateOnly] = useState(false);
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [priority, setPriority] = useState(2);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (k: ItemKind, itemId: number) => {
    setError('');
    setKind(k);
    setId(itemId);
    if (k === 'task') {
      const x = await tasks.getTask(itemId);
      if (!x) {
        return;
      }
      setTitle(x.title);
      setDetails(x.description ?? '');
      setPriority(x.priority);
      setDone(x.status === 'done');
      setWhen(x.dueAt ? new Date(x.dueAt) : null);
      setDateOnly(x.dueAt ? isDateOnlyDue(x.dueAt) : false);
    } else if (k === 'reminder') {
      const x = await reminders.getReminder(itemId);
      if (!x) {
        return;
      }
      setTitle(x.title);
      setDetails(x.message ?? '');
      setWhen(new Date(x.triggerAt));
      setRepeat(x.repeatRule === 'daily' || x.repeatRule === 'weekly' ? x.repeatRule : 'none');
    } else if (k === 'event') {
      const x = await events.getEvent(itemId);
      if (!x) {
        return;
      }
      setTitle(x.title);
      setDetails(x.notes ?? '');
      setWhen(new Date(x.startsAt));
    } else {
      const x = await notes.getNote(itemId);
      if (!x) {
        return;
      }
      setTitle(x.title ?? '');
      setDetails(x.body);
    }
    setVisible(true);
  }, []);

  const finish = (msg: string) => {
    setVisible(false);
    refresh();
    toast(msg);
  };

  const canSave = !busy && (kind === 'note' ? details.trim().length > 0 : title.trim().length > 0 && (kind === 'task' || !!when));

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const name = title.trim();
      const extra = details.trim() || null;
      if (kind === 'task') {
        const dueAt = when ? (dateOnly ? dateOnlyDue(when) : when.getTime()) : null;
        const x = await tasks.updateTask(id, { title: name, description: extra, priority, dueAt });
        if (x) {
          await syncTaskAlert(x).catch(() => undefined);
        }
      } else if (kind === 'reminder') {
        const rule = repeat === 'none' ? null : repeat;
        if (!rule && when!.getTime() <= Date.now()) {
          setError('That time has already passed.');
          return;
        }
        const x = await reminders.updateReminder(id, { title: name, message: extra, triggerAt: when!.getTime(), repeatRule: rule });
        await cancelReminderNotification(id);
        if (x) {
          await scheduleReminder(x).catch(() => undefined);
        }
      } else if (kind === 'event') {
        const x = await events.updateEvent(id, { title: name, notes: extra, startsAt: when!.getTime(), endsAt: null });
        await cancelEventAlert(id);
        if (x) {
          await scheduleEventAlert(x).catch(() => undefined);
        }
      } else {
        await notes.updateNote(id, { title: name || null, body: details.trim() });
      }
      finish(`${TITLES[kind]} updated.`);
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async () => {
    if (done) {
      await tasks.reopenTask(id);
      const x = await tasks.getTask(id);
      if (x) {
        await syncTaskAlert(x).catch(() => undefined);
      }
      finish('Task reopened.');
    } else {
      await tasks.completeTask(id);
      await cancelTaskAlert(id);
      finish('Task done.');
    }
  };

  const remove = async () => {
    if (!(await confirmAction(`Delete this ${kind}?`, 'Delete'))) {
      return;
    }
    if (kind === 'task') {
      await tasks.deleteTask(id);
      await cancelTaskAlert(id);
    } else if (kind === 'reminder') {
      await reminders.deleteReminder(id);
      await cancelReminderNotification(id);
    } else if (kind === 'event') {
      await events.deleteEvent(id);
      await cancelEventAlert(id);
    } else {
      await notes.deleteNote(id);
    }
    finish(`${TITLES[kind]} deleted.`);
  };

  const input = {
    color: t.text,
    fontSize: 17,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  } as const;

  return (
    <ItemDetailCtx.Provider value={{ open }}>
      {children}
      <Sheet visible={visible} onClose={() => setVisible(false)} title={TITLES[kind]}>
        <ScrollView style={{ maxHeight: height * 0.68 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={kind === 'note' ? 'Title (optional)' : 'Title'}
            placeholderTextColor={t.textDim}
            style={{ ...input, minHeight: 48 }}
          />
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={kind === 'note' ? 'Write a note…' : kind === 'reminder' ? 'Message (optional)' : 'Notes (optional)'}
            placeholderTextColor={t.textDim}
            multiline
            style={{ ...input, minHeight: kind === 'note' ? 140 : 72, maxHeight: 220, textAlignVertical: 'top' }}
          />
          {kind !== 'note' ? (
            <DateTimeField value={when} onChange={setWhen} optional={kind === 'task'} dateOnly={kind === 'task' && dateOnly} />
          ) : null}
          {kind === 'task' && when ? (
            <Row wrap>
              <Chip label="Date only" active={dateOnly} onPress={() => setDateOnly(true)} />
              <Chip label="Specific time" active={!dateOnly} onPress={() => setDateOnly(false)} />
            </Row>
          ) : null}
          {kind === 'task' ? (
            <Row wrap>
              {PRIORITIES.map(p => (
                <Chip key={p.value} label={p.label} active={priority === p.value} onPress={() => setPriority(p.value)} />
              ))}
            </Row>
          ) : null}
          {kind === 'reminder' ? (
            <Row wrap>
              {(['none', 'daily', 'weekly'] as const).map(r => (
                <Chip key={r} label={r === 'none' ? 'Once' : r === 'daily' ? 'Every day' : 'Every week'} active={repeat === r} onPress={() => setRepeat(r)} />
              ))}
            </Row>
          ) : null}
          {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
        </ScrollView>
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button label="Save changes" onPress={save} disabled={!canSave} />
          <Row>
            {kind === 'task' ? <Button label={done ? 'Mark not done' : 'Mark done'} kind="light" onPress={toggleDone} flex /> : null}
            <Button label="Delete" kind="danger" onPress={remove} flex />
          </Row>
        </View>
      </Sheet>
    </ItemDetailCtx.Provider>
  );
}
