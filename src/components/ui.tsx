import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'phosphor-react-native';
import { useTheme } from '../theme';

const MAX_CONTENT = 720;
const LOGO = require('../../assets/brand/logo-mark.png');

/** Responsive layout helper: gutters scale with screen width, content is capped on tablets. */
export function useLayout() {
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 14 : width < 600 ? 20 : 28;
  return { width, gutter, maxWidth: MAX_CONTENT, wide: width >= 600 };
}

/** Left-to-right action gradient fill (buttons, FAB, mic, selected chips). */
export function AccentFill({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <LinearGradient colors={t.gradientAccent} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={style}>
      {children}
    </LinearGradient>
  );
}

/** The Alphadron mascot. */
export function Logo({ size = 48 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size * 0.85 }} resizeMode="contain" accessibilityLabel="Alphadron" />;
}

/** Mascot + spaced wordmark, used as the app header. */
export function Wordmark({ subtitle }: { subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Logo size={50} />
      <View>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', letterSpacing: 4 }}>ALPHADRON</Text>
        {subtitle ? <Text style={{ color: t.textDim, fontSize: 13, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/** Safe-area screen with a centered, width-capped content column. The backdrop shows through. */
export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const { gutter, maxWidth } = useLayout();
  const inner: ViewStyle = { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingTop: 12, paddingBottom: 96, gap: 12 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
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
  return <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: 0.3 }}>{children}</Text>;
}

/** Frosted-glass panel. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>
  );
}

/** Small spaced-out caps header, like "YOUR ROADMAP". */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.section, { color: t.textDim }]}>{String(children).toUpperCase()}</Text>;
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
  const body = (color: string) => <Text style={{ color, fontWeight: '700', fontSize: 16, letterSpacing: 0.3 }}>{label}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1, flex: flex ? 1 : undefined }]}>
      {kind === 'primary' ? (
        <AccentFill style={[s.btn, s.btnGlow]}>{body(t.onAccent)}</AccentFill>
      ) : (
        <View style={[s.btn, { borderWidth: 1, borderColor: kind === 'danger' ? t.danger : t.border, backgroundColor: t.surface }]}>
          {body(kind === 'danger' ? t.danger : t.text)}
        </View>
      )}
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
  const text = (
    <>
      {icon}
      <Text style={{ color: active ? t.onAccent : t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </>
  );
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {active ? (
        <AccentFill style={s.chip}>{text}</AccentFill>
      ) : (
        <View style={[s.chip, { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }]}>{text}</View>
      )}
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
      style={({ pressed }) => [s.fab, { bottom: 16 + Math.min(insets.bottom, 8), opacity: pressed ? 0.88 : 1 }]}>
      <AccentFill style={s.fabInner}>
        <Plus size={28} color={t.onAccent} weight="bold" />
      </AccentFill>
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
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6, 4, 24, 0.62)', opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: t.sheet,
              borderColor: t.border,
              maxWidth,
              paddingBottom: 16 + insets.bottom,
              opacity: fade,
              transform: [{ translateY: y }],
            },
          ]}>
          <View style={[s.grab, { backgroundColor: t.border }]} />
          {title ? <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>{title}</Text> : null}
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
  card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 4 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1.8, marginTop: 14, marginBottom: 2 },
  btn: { minHeight: 52, paddingHorizontal: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnGlow: {
    shadowColor: '#FF4D8D',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#FF4D8D',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabInner: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 18,
    gap: 12,
  },
  grab: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
});
