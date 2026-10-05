import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'phosphor-react-native';
import { useTheme } from '../theme';

const MAX_CONTENT = 720;

/** Responsive layout helper: gutters scale with screen width, content is capped on tablets. */
export function useLayout() {
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 14 : width < 600 ? 20 : 28;
  return { width, gutter, maxWidth: MAX_CONTENT, wide: width >= 600 };
}

/** Safe-area screen with a centered, width-capped content column. */
export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const { gutter, maxWidth } = useLayout();
  const inner: ViewStyle = { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingTop: 12, paddingBottom: 96, gap: 10 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 28, fontWeight: '700' }}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.section, { color: t.textDim }]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  flex?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : 'transparent';
  const color = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.danger : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        {
          backgroundColor: bg,
          borderColor: kind === 'primary' ? bg : t.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          flex: flex ? 1 : undefined,
        },
      ]}>
      <Text style={{ color, fontWeight: '600', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        {
          borderColor: active ? t.accent : t.border,
          backgroundColor: active ? t.accent : t.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {icon}
      <Text style={{ color: active ? t.onAccent : t.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, gap = 8, wrap }: { children: React.ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', gap, alignItems: 'center', flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={{ color: t.textDim, paddingVertical: 16, textAlign: 'center' }}>{text}</Text>;
}

/** Floating "+" button that opens an add sheet. */
export function Fab({ onPress, label = 'Add' }: { onPress: () => void; label?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.fab,
        { backgroundColor: t.accent, bottom: 16 + Math.min(insets.bottom, 8), opacity: pressed ? 0.85 : 1 },
      ]}>
      <Plus size={28} color={t.onAccent} weight="bold" />
    </Pressable>
  );
}

/** Bottom sheet that slides up and sits above the keyboard. */
export function Sheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const t = useTheme();
  const { maxWidth } = useLayout();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(40)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      y.setValue(40);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, y, fade]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
              maxWidth,
              paddingBottom: 16 + insets.bottom,
              opacity: fade,
              transform: [{ translateY: y }],
            },
          ]}>
          <View style={[s.grab, { backgroundColor: t.border }]} />
          {title ? <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{title}</Text> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtDay(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  if (diff === 0) {
    return 'Today';
  }
  if (diff === 1) {
    return 'Tomorrow';
  }
  if (diff === -1) {
    return 'Yesterday';
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 14, marginBottom: 2 },
  btn: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  sheet: {
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 16,
    gap: 10,
  },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
});
