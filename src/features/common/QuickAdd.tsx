import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Row, Sheet } from '../../components/ui';
import { DateTimeField, formatPicked, toLocalIso } from '../../components/DateTimeField';
import { useTheme } from '../../theme';
import { executeTool } from '../../core/tools/executor';
import { platform } from '../../platform';
import { confirmAction } from '../../core/permissions/confirm';
import { useApp } from '../../services/AppState';
import { useAssistant } from '../assistant/AssistantProvider';

export type AddMode = 'reminder' | 'task' | 'event' | 'note';

interface Ctx {
  open: (mode?: AddMode) => void;
  toast: (msg: string) => void;
}

const QuickAddCtx = createContext<Ctx>({ open: () => undefined, toast: () => undefined });
export const useQuickAdd = () => useContext(QuickAddCtx);

const MODES: { key: AddMode; label: string }[] = [
  { key: 'reminder', label: 'Reminder' },
  { key: 'task', label: 'Task' },
  { key: 'event', label: 'Event' },
  { key: 'note', label: 'Note' },
];

const hourLater = () => new Date(Date.now() + 3600000);

/** Global quick-add sheet + toast. Manual entry goes through the same validated tool path as the AI. */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { settings } = useApp();
  const { refresh } = useAssistant();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<AddMode>('reminder');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (msg: string) => {
      setToastMsg(msg);
      toastAnim.setValue(0);
      Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      }, 2600);
    },
    [toastAnim],
  );

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  const open = useCallback((m: AddMode = 'reminder') => {
    setMode(m);
    setTitle('');
    setError('');
    setRepeat('none');
    setWhen(m === 'reminder' || m === 'event' ? hourLater() : null);
    setVisible(true);
  }, []);

  const switchMode = (m: AddMode) => {
    setMode(m);
    setError('');
    if ((m === 'reminder' || m === 'event') && !when) {
      setWhen(hourLater());
    }
  };

  const needsTime = mode === 'reminder' || mode === 'event';
  const canSave = title.trim().length > 0 && (!needsTime || !!when) && !saving;

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const text = title.trim();
      const iso = when ? toLocalIso(when) : undefined;
      const call =
        mode === 'reminder'
          ? { tool: 'create_reminder', args: { title: text, when: iso, ...(repeat !== 'none' ? { repeat } : {}) } }
          : mode === 'event'
            ? { tool: 'create_schedule', args: { title: text, when: iso } }
            : mode === 'task'
              ? { tool: 'create_task', args: { title: text, ...(iso ? { due_date: iso } : {}) } }
              : { tool: 'create_note', args: { body: text } };
      const r = await executeTool(call.tool, call.args, {
        now: new Date(),
        platform,
        memoryEnabled: settings.memoryEnabled,
        confirm: confirmAction,
      });
      if (!r.result.ok) {
        setError(r.result.summary);
        return;
      }
      setVisible(false);
      refresh();
      toast(r.result.summary);
    } finally {
      setSaving(false);
    }
  };

  const placeholder =
    mode === 'reminder' ? 'Remind me to…' : mode === 'task' ? 'What needs doing?' : mode === 'event' ? 'Event title' : 'Write a note…';

  return (
    <QuickAddCtx.Provider value={{ open, toast }}>
      {children}
      <Sheet visible={visible} onClose={() => setVisible(false)} title="Add">
        <Row wrap>
          {MODES.map(m => (
            <Chip key={m.key} label={m.label} active={mode === m.key} onPress={() => switchMode(m.key)} />
          ))}
        </Row>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={placeholder}
          placeholderTextColor={t.textDim}
          autoFocus
          multiline={mode === 'note'}
          style={{
            color: t.text,
            fontSize: 17,
            minHeight: 48,
            maxHeight: 160,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            textAlignVertical: mode === 'note' ? 'top' : 'center',
          }}
        />
        {mode !== 'note' ? (
          <DateTimeField value={when} onChange={setWhen} optional={mode === 'task'} />
        ) : null}
        {mode === 'reminder' ? (
          <Row wrap>
            {(['none', 'daily', 'weekly'] as const).map(r => (
              <Chip key={r} label={r === 'none' ? 'Once' : r === 'daily' ? 'Every day' : 'Every week'} active={repeat === r} onPress={() => setRepeat(r)} />
            ))}
          </Row>
        ) : null}
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
        <Button
          label={mode === 'reminder' && when ? `Remind me ${formatPicked(when).replace(/^(Today|Tomorrow)/, m => m.toLowerCase())}` : 'Save'}
          onPress={save}
          disabled={!canSave}
        />
      </Sheet>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 90 + insets.bottom,
          alignItems: 'center',
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}>
        <View style={{ backgroundColor: t.text, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 520 }}>
          <Text style={{ color: t.bg, fontSize: 15 }}>{toastMsg}</Text>
        </View>
      </Animated.View>
    </QuickAddCtx.Provider>
  );
}
