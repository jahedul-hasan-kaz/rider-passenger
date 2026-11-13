import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, touchTarget, type ColorRoles } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

// Smaller controls shared by many screens: checkbox, list row, star rating, vehicle icon, avatar, numbered step.

export function Checkbox({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (next: boolean) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      feedback="selection"
      scaleOnPress={false}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={styles.checkRow}>
      <View style={[styles.box, { borderColor: checked ? colors.primary : colors.borderStrong, backgroundColor: checked ? colors.primary : colors.surface }]}>
        {checked ? <Icon name="check" size={16} color="onPrimary" /> : null}
      </View>
      <Text style={styles.flex}>{label}</Text>
    </Pressable>
  );
}

/** Tappable row for menus and lists: icon, title, optional subtitle, trailing value or chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  tone = 'text',
  testID,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: ReactNode;
  onPress?: () => void;
  tone?: keyof ColorRoles;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      scaleOnPress={false}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={styles.row}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}>
          <Icon name={icon} size={18} color={tone} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text variant="bodyStrong" color={tone} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof value === 'string' ? (
        <Text variant="label" color="textMuted" tabular>
          {value}
        </Text>
      ) : (
        value
      )}
      {onPress && value === undefined ? <Icon name="chevron-right" size={18} color="textMuted" /> : null}
    </Pressable>
  );
}

export function StarRating({ value, onChange, size = 40, label }: { value: number; onChange: (score: number) => void; size?: number; label: string }) {
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value }} style={styles.stars}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable
          key={score}
          onPress={() => onChange(score)}
          feedback="selection"
          accessibilityRole="button"
          accessibilityLabel={`${score} / 5`}
          accessibilityState={{ selected: score <= value }}
          hitSlop={4}>
          <MaterialCommunityIcons name={score <= value ? 'star' : 'star-outline'} size={size} color={score <= value ? '#E0A100' : '#9DBDAF'} />
        </Pressable>
      ))}
    </View>
  );
}

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Vehicle type icon from the category code (`bike`, `cng`, `car`, …). */
export function VehicleIcon({ code, size = 32, color = 'text' }: { code: string; size?: number; color?: keyof ColorRoles }) {
  const { colors } = useTheme();
  const c = code.toLowerCase();
  const name: McIcon = c.includes('bike') || c.includes('moto') ? 'motorbike' : c.includes('cng') || c.includes('auto') ? 'rickshaw' : 'car-side';
  return <MaterialCommunityIcons name={name} size={size} color={colors[color]} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function Avatar({ name, size = 44, onPress, label }: { name?: string | null; size?: number; onPress?: () => void; label: string }) {
  const { colors } = useTheme();
  const initial = (name?.trim()[0] ?? '?').toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: colors.accent }]}>
      <Text variant="heading" color="onHero">
        {initial}
      </Text>
    </Pressable>
  );
}

/** Numbered reason or instruction ("1  Open Settings"). */
export function NumberedRow({ n, text, onDark = false }: { n: number; text: string; onDark?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.numbered, { backgroundColor: onDark ? colors.surfaceSelected : colors.surfaceMuted }]}>
      <View style={[styles.badge, { backgroundColor: onDark ? colors.accent : 'transparent' }]}>
        <Text variant="label" weight="800" color={onDark ? 'onAccent' : 'text'}>
          {n}
        </Text>
      </View>
      <Text variant="body" color={onDark ? 'onHero' : 'text'} style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: touchTarget },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 60, paddingVertical: space[2], paddingHorizontal: space[2], borderRadius: radius.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: space[2] },
  avatar: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  numbered: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderRadius: radius.md, padding: space[3] },
  badge: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
