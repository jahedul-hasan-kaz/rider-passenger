import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { recordConsent } from '@/features/auth/auth';
import { currentLanguage, setLanguage } from '@/i18n';
import { env } from '@/lib/env';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Button, Pressable, Text, VehicleIcon } from '@/ui';

const PAGES = 3;
const ADVANCE_MS = 4500;

// Welcome (docs/spec/03-screens.md §7.1, mockup 1). Renders fully offline.
export default function Welcome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const lang = currentLanguage();

  useEffect(() => {
    const timer = setInterval(() => setPage((p) => (p + 1) % PAGES), ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

  const openLegal = (url: string) => {
    if (url) void WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.hero, paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[4] }]}>
      <View style={styles.top}>
        <Text variant="title" color="onHero" accessibilityRole="header">
          {t('app.name')}
        </Text>
        <Pressable
          onPress={() => void setLanguage(lang === 'en' ? 'bn' : 'en')}
          accessibilityRole="button"
          accessibilityLabel={t('language.switchTo')}
          style={[styles.lang, { borderColor: colors.onHeroMuted }]}>
          <Text variant="label" color="onHero">
            {t('language.switchTo')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bento} accessible accessibilityLabel={t('welcome.cardsLabel')}>
        <View style={[styles.tile, styles.big, { backgroundColor: colors.surfaceSelected }]}>
          <VehicleIcon code="bike" size={64} color="accent" />
          <View>
            <Text variant="heading" color="onHero">
              {t('welcome.bike')}
            </Text>
            <Text variant="caption" color="onHeroMuted">
              {t('welcome.bikeSub')}
            </Text>
          </View>
        </View>
        <View style={styles.column}>
          <View style={[styles.tile, styles.small, { backgroundColor: colors.accent }]}>
            <Text variant="title" color="onAccent">
              {t('welcome.pickup')}
            </Text>
            <Text variant="caption" color="onAccent">
              {t('welcome.pickupSub')}
            </Text>
          </View>
          <View style={[styles.tile, styles.small, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="bodyStrong" color="text">
              {t('welcome.cngCar')}
            </Text>
            <Text variant="caption" color="textMuted">
              {t('welcome.fareFirst')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.copy} accessibilityLiveRegion="polite">
        <Text variant="display" color="onHero" accessibilityRole="header">
          {t(`welcome.pages.${page}.title`)}
        </Text>
        <Text color="onHeroMuted">{t(`welcome.pages.${page}.body`)}</Text>
      </View>

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: PAGES }, (_, i) => (
          <Pressable
            key={i}
            onPress={() => setPage(i)}
            scaleOnPress={false}
            hitSlop={10}
            style={[styles.dot, { width: i === page ? 24 : 8, backgroundColor: i === page ? colors.accent : colors.onHeroMuted }]}
          />
        ))}
      </View>

      <Button
        testID="get-started"
        label={t('welcome.getStarted')}
        variant="accent"
        onPress={() => {
          recordConsent();
          // Email codes always work; phone sign-in only when an SMS gateway is set up.
          router.push(env().EXPO_PUBLIC_PHONE_SIGN_IN ? '/phone' : '/email');
        }}
      />
      <Text variant="caption" color="onHeroMuted" align="center">
        {t('welcome.consentPrefix')}{' '}
        <Text variant="caption" color="onHero" weight="600" style={styles.link} onPress={() => openLegal(env().EXPO_PUBLIC_TERMS_URL)} accessibilityRole="link">
          {t('welcome.terms')}
        </Text>{' '}
        {t('welcome.and')}{' '}
        <Text variant="caption" color="onHero" weight="600" style={styles.link} onPress={() => openLegal(env().EXPO_PUBLIC_PRIVACY_URL)} accessibilityRole="link">
          {t('welcome.privacy')}
        </Text>
        {t('welcome.consentSuffix')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space[5], gap: space[5] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lang: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[4], minHeight: 44, justifyContent: 'center' },
  bento: { flexDirection: 'row', gap: space[3], height: 280 },
  column: { flex: 1, gap: space[3] },
  tile: { borderRadius: radius.lg, padding: space[4], justifyContent: 'space-between' },
  big: { flex: 1.35 },
  small: { flex: 1, justifyContent: 'flex-end' },
  copy: { flex: 1, justifyContent: 'flex-end', gap: space[3] },
  dots: { flexDirection: 'row', gap: space[2] },
  dot: { height: 8, borderRadius: 4 },
  link: { textDecorationLine: 'underline' },
});
