import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useOnline } from '@/lib/use-online';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useAppear } from './use-appear';

/** Global "you're offline" strip (§12.1). Announced once when it appears. */
export function OfflineBar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const online = useOnline();
  if (online) return null;
  return <OfflineStrip label={t('network.offline')} background={colors.warningSurface} />;
}

function OfflineStrip({ label, background }: { label: string; background: string }) {
  const appear = useAppear();
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.offline, { backgroundColor: background }, appear]}>
      <Icon name="wifi-off" size={16} color="warningText" />
      <Text variant="caption" color="warningText" weight="600">
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * Deep-green header that curves into the pale screen (mockups 2, 3, 6, 7). Holds the back button, the step
 * indicator and the screen title; content below overlaps its rounded bottom edge.
 */
export function HeroHeader({
  title,
  subtitle,
  onBack,
  right,
  children,
  overlap = 0,
}: {
  title?: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  /** How far the next element tucks under the curved edge (e.g. a card that straddles it). */
  overlap?: number;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + space[4], paddingBottom: space[6] + overlap }]}>
      {onBack || right ? (
        <View style={styles.heroTop}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('ui.back')}
              hitSlop={8}
              style={[styles.back, { borderColor: colors.onHeroMuted }]}>
              <Icon name="chevron-left" color="onHero" size={22} />
            </Pressable>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
      {title ? (
        <Text variant="title" color="onHero" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {typeof subtitle === 'string' ? <Text color="onHeroMuted">{subtitle}</Text> : subtitle}
    </View>
  );
}

/**
 * Standard screen: themed background, safe areas, keyboard avoidance, optional hero and a footer pinned to the
 * bottom for the one primary action (§1.3).
 */
export function Screen({
  children,
  hero,
  footer,
  scroll = true,
  padded = true,
  contentStyle,
  testID,
}: {
  children: ReactNode;
  hero?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const body = [styles.body, padded && styles.padded, !hero && { paddingTop: insets.top + space[4] }, contentStyle];

  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBar />
      {scroll ? (
        // The hero scrolls away with the content; content tucks under its curved edge and is drawn above it.
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.grow}>
          {hero}
          <View style={[body, hero ? styles.underHero : undefined]}>{children}</View>
        </ScrollView>
      ) : (
        <>
          {hero}
          <View style={[styles.flex, body, hero ? styles.underHero : undefined]}>{children}</View>
        </>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space[4] }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  body: { gap: space[4], flexGrow: 1 },
  padded: { paddingHorizontal: space[4], paddingBottom: space[6] },
  underHero: { marginTop: -space[6] },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[3] },
  hero: { paddingHorizontal: space[5], gap: space[3], borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  back: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], paddingVertical: space[2] },
});
