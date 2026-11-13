import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { haptic } from '@/lib/haptics';
import { formatMoney } from '@/lib/format';
import { radius, space, type ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

// Ride-specific pieces of the design system (§5.3): fare breakdown, countdown ring, map pin, SOS button.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type FareLine = { label: string; amount: string; kind?: 'normal' | 'discount' | 'total' | 'note' };

/** Itemised fare. Amounts are server strings; this component never adds them up (§8.1). */
export function FareBreakdown({ lines, testID }: { lines: FareLine[]; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.fare}>
      {lines.map((line, index) => {
        const total = line.kind === 'total';
        const discount = line.kind === 'discount';
        return (
          <View
            key={`${line.label}-${index}`}
            accessible
            accessibilityLabel={`${line.label}, ${formatMoney(line.amount)}`}
            style={[styles.fareRow, total && [styles.fareTotal, { borderTopColor: colors.border }]]}>
            <Text variant={total ? 'heading' : 'body'} color={line.kind === 'note' ? 'textMuted' : 'text'} style={styles.flex}>
              {line.label}
            </Text>
            <Text variant={total ? 'heading' : 'body'} color={discount ? 'successText' : 'text'} tabular weight={total ? '800' : undefined}>
              {discount ? formatMoney(`-${line.amount.replace(/^-/, '')}`) : formatMoney(line.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Ring that drains towards `endsAt` (quote expiry, free-cancellation window). Driven by the clock, not by a counter,
 * so it stays correct after the app was in the background.
 */
export function CountdownRing({
  endsAt,
  totalSeconds,
  size = 56,
  color = 'accent',
  onExpire,
}: {
  endsAt: number;
  totalSeconds: number;
  size?: number;
  color?: keyof ColorRoles;
  onExpire?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !expired.current) {
      expired.current = true;
      onExpire?.();
    }
  }, [left, onExpire]);

  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = totalSeconds > 0 ? left / totalSeconds : 0;
  const label = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : String(left);

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={t('ui.secondsLeft', { count: left })}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors[color]}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="label" tabular>
        {label}
      </Text>
    </View>
  );
}

/** Pickup pin with a soft pulse (searching / "move the map to adjust"). The pulse stops under reduced motion. */
export function MapPin({ label, lifted = false, pulsing = true }: { label?: string; lifted?: boolean; pulsing?: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (pulsing && !reduceMotion) pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
    else {
      cancelAnimation(pulse);
      pulse.set(0);
    }
  }, [pulse, pulsing, reduceMotion]);

  useEffect(() => {
    lift.set(withTiming(lifted ? -10 : 0, { duration: reduceMotion ? 0 : 150 }));
  }, [lift, lifted, reduceMotion]);

  const ring = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - pulse.value), transform: [{ scale: 0.6 + pulse.value * 1.4 }] }));
  const pin = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <View style={styles.pinWrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.pinPulse, { backgroundColor: colors.accent }, ring]} />
      {label ? (
        <View style={[styles.pinLabel, { backgroundColor: colors.hero, borderColor: colors.accent }]}>
          <Text variant="caption" color="onHero" weight="600">
            {label}
          </Text>
        </View>
      ) : null}
      <Animated.View style={pin}>
        <Svg width={36} height={46} viewBox="0 0 36 46">
          <Path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 28 18 28s18-15.4 18-28C36 8.06 27.94 0 18 0z" fill={colors.accent} />
          <Circle cx={18} cy={18} r={7} fill={colors.hero} />
        </Svg>
      </Animated.View>
      <View style={[styles.pinShadow, { backgroundColor: colors.shadow }]} />
    </View>
  );
}

const HOLD_MS = 2000;

/**
 * Press and hold for 2 seconds to send SOS (§7.14): a ring fills while held and releasing early cancels it, so a
 * pocket tap never raises an alarm. Heavy haptic on trigger.
 */
export function SosButton({ onTrigger, size = 72, testID }: { onTrigger: () => void; size?: number; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const stroke = 5;
  const r = (size + 12 - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const fire = () => {
    haptic('sos');
    onTrigger();
  };

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

  return (
    <Pressable
      testID={testID}
      scaleOnPress={false}
      accessibilityRole="button"
      accessibilityLabel={t('ui.sos')}
      accessibilityHint={t('ui.sosHint')}
      // Screen-reader users activate with a double tap; holding is not practical there.
      onAccessibilityAction={(event) => event.nativeEvent.actionName === 'activate' && fire()}
      accessibilityActions={[{ name: 'activate' }]}
      onPressIn={() => {
        haptic('tap');
        progress.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(fire)();
        }));
      }}
      onPressOut={() => {
        cancelAnimation(progress);
        progress.set(withTiming(0, { duration: 150 }));
      }}
      style={{ width: size + 12, height: size + 12, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size + 12} height={size + 12} style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          cx={(size + 12) / 2}
          cy={(size + 12) / 2}
          r={r}
          stroke={colors.dangerText}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${(size + 12) / 2} ${(size + 12) / 2})`}
        />
      </Svg>
      <View style={[styles.sos, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.dangerText }]}>
        <Icon name="alert-triangle" color="onPrimary" size={22} />
        <Text variant="label" color="onPrimary" weight="800">
          SOS
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fare: { gap: space[2] },
  fareRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 28 },
  fareTotal: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: space[3], marginTop: space[1] },
  pinWrap: { alignItems: 'center', justifyContent: 'flex-end', width: 140, height: 140 },
  pinPulse: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: 10 },
  pinLabel: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: 2, marginBottom: space[1] },
  pinShadow: { width: 14, height: 5, borderRadius: 3, opacity: 0.3, marginTop: 2 },
  sos: { alignItems: 'center', justifyContent: 'center' },
});
