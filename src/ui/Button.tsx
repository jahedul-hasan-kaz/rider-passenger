import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { HapticEvent } from '@/lib/haptics';
import { radius, space, touchTarget, type ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'ghostOnHero' | 'danger';

type Palette = { bg: keyof ColorRoles | 'transparent'; fg: keyof ColorRoles; border?: keyof ColorRoles };

// `primary` = deep green on light surfaces (mint in dark theme); `accent` = mint, for buttons on the dark hero.
const VARIANTS: Record<ButtonVariant, Palette> = {
  primary: { bg: 'primary', fg: 'onPrimary' },
  accent: { bg: 'accent', fg: 'onAccent' },
  secondary: { bg: 'surface', fg: 'text', border: 'border' },
  ghost: { bg: 'transparent', fg: 'text' },
  // Text-only button on the deep-green hero background.
  ghostOnHero: { bg: 'transparent', fg: 'onHero' },
  // Filled with the darker *text* red: white on the marker red (#E5533D) is below 4.5:1.
  danger: { bg: 'dangerText', fg: 'onPrimary' },
};

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  disabled?: boolean;
  /** Shows a spinner, keeps the label for screen readers, and blocks repeat taps. */
  loading?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  fullWidth?: boolean;
  feedback?: HapticEvent;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** One primary action per screen (§1.3): full width, thumb height, never double-fires while loading. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  feedback = 'tap',
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const { colors, scheme } = useTheme();
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  // Dark theme's red is light, so its label is deep green instead of white.
  const fg: keyof ColorRoles = disabled ? 'onDisabled' : variant === 'danger' && scheme === 'dark' ? 'onAccent' : v.fg;
  const bg = disabled ? colors.disabled : v.bg === 'transparent' ? 'transparent' : colors[v.bg];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      feedback={inactive ? undefined : feedback}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === 'md' ? 4 : 0}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        fullWidth && styles.full,
        { backgroundColor: bg },
        v.border && !disabled ? { borderWidth: 1, borderColor: colors[v.border] } : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[fg]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <Icon name={leftIcon} color={fg} size={20} /> : null}
          <Text variant="bodyStrong" weight="700" color={fg} numberOfLines={1}>
            {label}
          </Text>
          {rightIcon ? <Icon name={rightIcon} color={fg} size={20} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[5] },
  lg: { minHeight: 56 },
  md: { minHeight: touchTarget },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
