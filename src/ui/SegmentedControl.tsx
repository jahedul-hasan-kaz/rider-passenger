import { StyleSheet, View } from 'react-native';

import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

export type Segment<T extends string> = { value: T; label: string };

/** Mutually exclusive options in one row: Home / Office / Other (§7.8). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      {segments.map((segment, index) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            testID={testID ? `${testID}-${segment.value}` : undefined}
            onPress={() => !selected && onChange(segment.value)}
            feedback="selection"
            scaleOnPress={false}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            accessibilityHint={`${index + 1} / ${segments.length}`}
            style={[styles.segment, selected && { backgroundColor: colors.primary }]}>
            <Text variant="label" color={selected ? 'onPrimary' : 'text'} numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.md, padding: space[1], gap: space[1] },
  segment: { flex: 1, minHeight: touchTarget, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
});
