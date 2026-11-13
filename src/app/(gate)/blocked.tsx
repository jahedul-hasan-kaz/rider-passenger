import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { signOut } from '@/features/auth/auth';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Button, Icon, Text } from '@/ui';

// Account can't book (docs/spec/03-screens.md §7.3 role handling): a driver or staff account, or a passenger
// account that is suspended or deactivated. Always offers a way out: support, or another number.
export default function Blocked() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { reason } = useLocalSearchParams<{ reason?: 'role' | 'suspended' | 'deactivated' }>();
  const kind = reason === 'suspended' || reason === 'deactivated' ? reason : 'role';
  const [leaving, setLeaving] = useState(false);

  const switchNumber = async () => {
    setLeaving(true);
    await signOut().catch(() => undefined);
    router.replace('/welcome');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.hero, paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[4] }]}>
      <View style={[styles.icon, { backgroundColor: colors.dangerSurface }]}>
        <Icon name={kind === 'role' ? 'user-x' : 'slash'} size={32} color="dangerText" />
      </View>
      <Text variant="title" color="onHero" accessibilityRole="header">
        {t(`blocked.${kind}.title`)}
      </Text>
      <Text color="onHeroMuted">{t(`blocked.${kind}.body`)}</Text>
      <View style={styles.footer}>
        {kind === 'suspended' ? (
          <Button label={t('blocked.contactSupport')} variant="accent" leftIcon="life-buoy" onPress={() => router.push('/support')} />
        ) : null}
        <Button label={t('blocked.otherNumber')} variant={kind === 'suspended' ? 'secondary' : 'accent'} loading={leaving} onPress={() => void switchNumber()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space[5], gap: space[4] },
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 'auto', gap: space[3] },
});
