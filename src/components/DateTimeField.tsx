import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarBlank } from 'phosphor-react-native';
import { Chip, Row } from './ui';
import { useTheme } from '../theme';

const atHour = (base: Date, dayOffset: number, hour: number, minute = 0) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute);

export function formatPicked(d: Date, now = new Date(), dateOnly = false): string {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  const label =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (dateOnly) {
    return label;
  }
  const h = d.getHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return `${label}, ${time}`;
}

/** Local ISO string (YYYY-MM-DDTHH:MM) that the app's date parser understands. */
export function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Quick time chips plus a native date -> time picker. */
export function DateTimeField({
  value,
  onChange,
  optional,
  dateOnly,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  optional?: boolean;
  dateOnly?: boolean;
}) {
  const t = useTheme();
  const now = new Date();
  const quick: { label: string; date: Date }[] = [
    { label: 'In 1 hour', date: new Date(now.getTime() + 3600000) },
    ...(now.getHours() < 17 ? [{ label: 'This evening', date: atHour(now, 0, 18) }] : []),
    { label: 'Tomorrow 9 AM', date: atHour(now, 1, 9) },
    { label: 'Next week', date: atHour(now, 7, 9) },
  ];

  const pick = () => {
    const base = value ?? new Date(now.getTime() + 3600000);
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      minimumDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      onChange: (_e, date) => {
        if (!date) {
          return;
        }
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: false,
          onChange: (_e2, time) => {
            if (!time) {
              return;
            }
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()));
          },
        });
      },
    });
  };

  return (
    <View style={{ gap: 8 }}>
      <Row wrap>
        {quick.map(q => (
          <Chip
            key={q.label}
            label={q.label}
            active={!!value && Math.abs(value.getTime() - q.date.getTime()) < 60000}
            onPress={() => onChange(q.date)}
          />
        ))}
      </Row>
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          minHeight: 48,
          paddingHorizontal: 14,
        }}>
        <CalendarBlank size={22} color={t.accent} />
        <Text style={{ color: value ? t.text : t.textDim, fontSize: 16, flex: 1 }}>
          {value ? formatPicked(value, new Date(), dateOnly) : 'Pick date & time'}
        </Text>
        {optional && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10}>
            <Text style={{ color: t.danger }}>Clear</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}
