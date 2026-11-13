import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { radius, space, type ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// Status surfaces (§5.3): banner, skeleton, empty state, divider.

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<BannerTone, { bg: keyof ColorRoles; fg: keyof ColorRoles; icon: IconName }> = {
  info: { bg: 'infoSurface', fg: 'infoText', icon: 'info' },
  success: { bg: 'successSurface', fg: 'successText', icon: 'check-circle' },
  warning: { bg: 'warningSurface', fg: 'warningText', icon: 'alert-triangle' },
  danger: { bg: 'dangerSurface', fg: 'dangerText', icon: 'alert-octagon' },
  neutral: { bg: 'surfaceMuted', fg: 'text', icon: 'info' },
};

/** Inline notice with an icon, so meaning never rests on colour alone (§5.5). */
export function Banner({
  tone = 'neutral',
  title,
  body,
  icon,
  action,
  testID,
}: {
  tone?: BannerTone;
  title?: string;
  body: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { colors } = useTheme();
  const t = TONES[tone];
  return (
    <View
      testID={testID}
      // Read as one message; with an action the button must stay reachable on its own, so no grouping then.
      accessible={!action}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[styles.banner, { backgroundColor: colors[t.bg] }]}>
      <Icon name={icon ?? t.icon} color={t.fg} size={18} />
      <View style={styles.bannerText}>
        {title ? (
          <Text variant="label" color={t.fg}>
            {title}
          </Text>
        ) : null}
        <Text variant="caption" color={tone === 'neutral' ? 'text' : t.fg}>
          {body}
        </Text>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} size="md" variant="primary" fullWidth={false} /> : null}
    </View>
  );
}

/** Placeholder block shown while content loads; pulses unless the user prefers reduced motion. */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) opacity.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityLabel={t('common.loading')}
      accessibilityRole="progressbar"
      style={[{ width, height, borderRadius: rounded, backgroundColor: colors.surfaceMuted }, pulse, style]}
    />
  );
}

/** "Nothing here yet" with a way forward — never a dead end (§1.4). */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={icon} size={28} color="textMuted" />
      </View>
      <Text variant="heading" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text color="textMuted" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="primary" /> : null}
    </View>
  );
}

/** Hairline, optionally with a centred word ("or"). */
export function Divider({ label }: { label?: string }) {
  const { colors } = useTheme();
  if (!label) return <View style={[styles.line, { backgroundColor: colors.border }]} />;
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.line, styles.flex, { backgroundColor: colors.border }]} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.line, styles.flex, { backgroundColor: colors.border }]} />
    </View>
  );
}

export function Row({ children, gap = 3, style }: { children: ReactNode; gap?: keyof typeof space; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space[gap] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md },
  bannerText: { flex: 1, gap: 2 },
  empty: { alignItems: 'center', gap: space[3], padding: space[6] },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  line: { height: StyleSheet.hairlineWidth * 2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
});
