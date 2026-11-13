import { StyleSheet } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** Compact choice or tag: quick reasons, vehicle chip, trust markers ("Number masking"). */
export function Chip({
  label,
  icon,
  selected = false,
  onPress,
  testID,
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const fg = selected ? 'onPrimary' : 'text';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      feedback={onPress ? 'selection' : undefined}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected } : undefined}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border },
      ]}>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
  },
});
