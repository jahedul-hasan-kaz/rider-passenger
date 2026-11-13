import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { prefs } from '@/lib/storage';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Button, Icon, Text, useToast } from '@/ui';

const NOTIFY_KEY = 'area.notifyWhenAvailable';

// Out of service area (docs/spec/03-screens.md §7.5). Shown when the pickup point is outside every active zone.
export default function OutOfArea() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const [notify, setNotify] = useState(() => prefs.getString(NOTIFY_KEY) === 'yes');

  return (
    <View style={[styles.screen, { backgroundColor: colors.hero, paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[4] }]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceSelected }]}>
        <Icon name="map" size={36} color="accent" />
      </View>
      <Text variant="display" color="onHero" accessibilityRole="header">
        {t('area.title')}
      </Text>
      <Text color="onHeroMuted">{area ? t('area.bodyWithPlace', { place: area }) : t('area.body')}</Text>
      <Text color="onHeroMuted">{t('area.covered')}</Text>
      <View style={styles.footer}>
        <Button label={t('area.pickOnMap')} variant="accent" leftIcon="crosshair" onPress={() => router.push({ pathname: '/pin', params: { mode: 'pickup' } })} />
        <Button
          label={notify ? t('area.notifyOn') : t('area.notify')}
          variant="secondary"
          leftIcon={notify ? 'check' : 'bell'}
          disabled={notify}
          onPress={() => {
            // Stored on the device for now; it becomes a push topic once notifications ship (spec §10).
            prefs.set(NOTIFY_KEY, 'yes');
            setNotify(true);
            toast({ message: t('area.notifySaved'), tone: 'success' });
          }}
        />
        <Button label={t('common.retry')} variant="ghostOnHero" onPress={() => router.replace('/home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space[5], gap: space[4] },
  icon: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 'auto', gap: space[3] },
});
