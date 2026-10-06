import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

function Orb({
  size,
  colors,
  style,
  opacity = 1,
}: {
  size: number;
  colors: [string, string];
  style: object;
  opacity?: number;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0.15, y: 0.1 }}
      end={{ x: 0.85, y: 0.95 }}
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, opacity }, style]}
    />
  );
}

function Ring({ size, color, style }: { size: number; color: string; style: object }) {
  return (
    <View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color },
        style,
      ]}
    />
  );
}

/**
 * The glass identity: a deep indigo wash with soft glowing orbs and thin rings.
 * Decorative only, kept toward the edges so text stays legible. Sits behind everything.
 */
export function Backdrop() {
  const t = useTheme();
  const { width: w, height: h } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={t.gradientBg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <Orb size={w * 0.85} colors={t.orbWarm} opacity={t.dark ? 0.85 : 0.7} style={{ right: -w * 0.38, top: -w * 0.32 }} />
      <Orb size={w * 0.6} colors={t.orbCool} opacity={t.dark ? 0.55 : 0.5} style={{ left: -w * 0.34, top: h * 0.34 }} />
      <Orb size={w * 0.95} colors={t.orbWarm} opacity={t.dark ? 0.8 : 0.65} style={{ right: -w * 0.5, bottom: -w * 0.4 }} />
      <Orb size={Math.max(34, w * 0.1)} colors={t.orbWarm} opacity={0.9} style={{ left: w * 0.06, top: h * 0.2 }} />
      <Orb size={Math.max(22, w * 0.06)} colors={t.orbCool} opacity={0.8} style={{ right: w * 0.12, top: h * 0.52 }} />
      <Ring size={w * 0.7} color={t.ring} style={{ left: w * 0.22, top: -w * 0.34 }} />
      <Ring size={w * 0.34} color={t.ring} style={{ left: -w * 0.1, bottom: h * 0.08 }} />
    </View>
  );
}
