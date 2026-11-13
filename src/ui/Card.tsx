import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation, radius, space, type ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { Pressable } from './Pressable';

export type CardTone = 'surface' | 'muted' | 'brand' | 'accent';

const TONE_BG: Record<CardTone, keyof ColorRoles> = {
  surface: 'surface',
  muted: 'surfaceMuted',
  brand: 'surfaceSelected',
  accent: 'accent',
};

export function Card({
  children,
  tone = 'surface',
  padded = true,
  elevated = false,
  style,
  testID,
}: {
  children: ReactNode;
  tone?: CardTone;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        padded && styles.padded,
        { backgroundColor: colors[TONE_BG[tone]] },
        elevated && [elevation.card, { shadowColor: colors.shadow }],
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * A card the user picks from a set (vehicle types, saved places): mint ring + check badge when selected,
 * announced as a radio button so screen readers say "selected, 1 of 3".
 */
export function SelectableCard({
  children,
  selected,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: {
  children: ReactNode;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      feedback="selection"
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, checked: selected }}
      style={[
        styles.card,
        styles.padded,
        styles.selectable,
        {
          backgroundColor: selected ? colors.surfaceSelected : colors.surface,
          borderColor: selected ? colors.accent : 'transparent',
        },
        style,
      ]}>
      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.accent }]}>
          <Icon name="check" size={16} color="onAccent" />
        </View>
      ) : null}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
  padded: { padding: space[4] },
  selectable: { borderWidth: 2 },
  check: {
    position: 'absolute',
    top: space[3],
    right: space[3],
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
