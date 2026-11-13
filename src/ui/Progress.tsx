import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { duration, radius, space, type ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Text } from './Text';

/** Thin animated bar (onboarding steps, quote refresh). `value` is 0–1. */
export function ProgressBar({
  value,
  track = 'border',
  fill = 'accent',
  accessibilityLabel,
}: {
  value: number;
  track?: keyof ColorRoles;
  fill?: keyof ColorRoles;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, value));
  const progress = useSharedValue(clamped);

  useEffect(() => {
    progress.set(reduceMotion ? clamped : withTiming(clamped, { duration: duration.slow }));
  }, [clamped, progress, reduceMotion]);

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: colors[track] }]}>
      <Animated.View style={[styles.fill, { backgroundColor: colors[fill] }, bar]} />
    </View>
  );
}

/** "Step 1 of 3" + bar, as on the onboarding headers (§7.2–7.4). Designed for the dark hero. */
export function StepIndicator({ step, total, onHero = true }: { step: number; total: number; onHero?: boolean }) {
  const { t } = useTranslation();
  const label = t('ui.stepOf', { step, total });
  return (
    <View style={styles.step}>
      <Text variant="label" color={onHero ? 'onHeroMuted' : 'textMuted'} align="right">
        {label}
      </Text>
      <ProgressBar value={step / total} track={onHero ? 'surfaceSelected' : 'border'} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  step: { gap: space[2] },
});
