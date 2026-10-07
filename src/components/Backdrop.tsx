import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { backdropSvg } from './backdropSvg';
import { useTheme } from '../theme';

/**
 * The identity backdrop: a deep navy field with a luminous aurora wave on the right and bottom edges
 * and thin flowing lines. It is decorative only and sits behind everything.
 */
export function Backdrop() {
  const t = useTheme();
  const xml = useMemo(() => backdropSvg(t.wave), [t.wave]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    </View>
  );
}
