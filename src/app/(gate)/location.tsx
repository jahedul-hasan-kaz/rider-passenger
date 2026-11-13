import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLocationPermission } from '@/features/location/location';
import { track } from '@/lib/analytics';
import { palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Button, Icon, MapPin, NumberedRow, ProgressBar, Sheet, Text, type SheetHandle } from '@/ui';

// Location gate (docs/spec/03-screens.md §7.4, mockups 4–5). Explains why before the OS dialog, asks for
// foreground access only, and re-checks by itself when the passenger comes back from Settings.
export default function LocationGate() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const permission = useLocationPermission();
  const help = useRef<SheetHandle>(null);
  const [problem, setProblem] = useState<'blocked' | 'services' | 'precise' | null>(null);

  const ready = permission.status === 'granted' && permission.servicesOn && permission.precise;
  useEffect(() => {
    if (ready) {
      help.current?.dismiss();
      router.replace('/');
    }
  }, [ready]);

  const allow = async () => {
    let state = permission.status === 'granted' ? permission : await permission.request();
    if (state.status === 'denied') state = await permission.request();
    track('location_permission_result', { status: state.status, precise: state.precise, services_on: state.servicesOn });
    if (state.status !== 'granted') return show('blocked');
    if (!state.servicesOn) {
      if (Platform.OS === 'android') await Location.enableNetworkProviderAsync().catch(() => undefined);
      const after = await permission.recheck();
      if (!after.servicesOn) return show('services');
    }
    if (!state.precise) return show('precise');
  };

  const show = (kind: 'blocked' | 'services' | 'precise') => {
    setProblem(kind);
    help.current?.present();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.hero, paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[4] }]}>
      <View style={styles.step}>
        <Text variant="label" color="onHeroMuted">
          {t('location.step')}
        </Text>
        <ProgressBar value={1} track="surfaceSelected" />
      </View>

      <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.ring, styles.ring1, { backgroundColor: palette.brand800 }]} />
        <View style={[styles.ring, styles.ring2, { backgroundColor: palette.brand700, opacity: 0.8 }]} />
        <MapPin />
      </View>

      <Text variant="title" color="onHero" accessibilityRole="header">
        {t('location.title')}
      </Text>
      <View style={styles.reasons}>
        <NumberedRow n={1} text={t('location.reason1')} onDark />
        <NumberedRow n={2} text={t('location.reason2')} onDark />
        <NumberedRow n={3} text={t('location.reason3')} onDark />
      </View>

      <View style={styles.footer}>
        <Button testID="allow-location" label={t('location.allow')} variant="accent" onPress={() => void allow()} />
        <Text variant="caption" color="onHeroMuted" align="center">
          {t('location.footnote')}
        </Text>
        <Button label={t('location.later')} variant="ghostOnHero" size="md" onPress={() => router.push('/account')} style={styles.later} />
      </View>

      <Sheet ref={help} onDismiss={() => setProblem(null)}>
        <View style={[styles.offIcon, { backgroundColor: colors.dangerSurface }]}>
          <Icon name="map-pin" size={26} color="dangerText" />
        </View>
        <Text variant="title" accessibilityRole="header">
          {t(`location.${problem ?? 'blocked'}.title`)}
        </Text>
        <Text color="textMuted">{t(`location.${problem ?? 'blocked'}.body`)}</Text>
        {problem === 'blocked' || problem === 'precise' ? (
          <View style={styles.reasons}>
            <NumberedRow n={1} text={t('location.steps.1')} />
            <NumberedRow n={2} text={t(Platform.OS === 'ios' ? 'location.steps.2ios' : 'location.steps.2android')} />
            <NumberedRow n={3} text={t(problem === 'precise' ? 'location.steps.3precise' : 'location.steps.3')} />
          </View>
        ) : null}
        <Button label={t('location.openSettings')} onPress={() => void Linking.openSettings()} />
        <Button label={t('common.retry')} variant="secondary" onPress={() => void allow()} />
        <Text variant="caption" color="textMuted" align="center">
          {t('location.autoRecheck')}
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space[5], gap: space[5] },
  step: { gap: space[3] },
  art: { height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999 },
  ring1: { width: 220, height: 220, opacity: 0.6 },
  ring2: { width: 150, height: 150 },
  reasons: { gap: space[2] },
  footer: { marginTop: 'auto', gap: space[3] },
  later: { alignSelf: 'center' },
  offIcon: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
