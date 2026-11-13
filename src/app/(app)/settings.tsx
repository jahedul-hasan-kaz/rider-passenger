import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';
import { getNotificationPrefs, setNotificationPrefs, type NotificationPrefs } from '@/api/endpoints/me';
import { signOut } from '@/features/auth/auth';
import { currentLanguage, errorMessage, setLanguage, type Language } from '@/i18n';
import { env } from '@/lib/env';
import { prefs } from '@/lib/storage';
import { space } from '@/theme/tokens';
import { useTheme, type ThemeMode } from '@/theme/theme';
import { Button, Card, HeroHeader, ListRow, Row, Screen, SegmentedControl, Text, useToast } from '@/ui';

const NOTIFY = ['ride', 'support', 'offers'] as const;
type NotifyKey = (typeof NOTIFY)[number];

// Settings (docs/spec/03-screens.md §7.16). Notification choices live on the account (rider-admin
// /me/notification-preferences), which decides what gets sent; a copy on the phone lets the push handler filter
// immediately and keeps the switches right offline. Safety messages cannot be turned off.

const PREFS_KEY = ['notification-preferences'] as const;

/** Phone copy of the account's choices, read by the push handler (features/push/push.ts). */
export function mirrorNotificationPrefs(p: Pick<NotificationPrefs, 'ride' | 'support' | 'offers'>) {
  for (const key of NOTIFY) prefs.set(`notify.${key}`, p[key] ? 'on' : 'off');
}
export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [lang, setLang] = useState<Language>(currentLanguage());
  const toast = useToast();
  const queryClient = useQueryClient();
  const server = useQuery({ queryKey: PREFS_KEY, queryFn: () => getNotificationPrefs(api()) });
  const local: Record<NotifyKey, boolean> = {
    ride: prefs.getString('notify.ride') !== 'off',
    support: prefs.getString('notify.support') !== 'off',
    offers: prefs.getString('notify.offers') === 'on',
  };
  const [pending, setPending] = useState<Record<NotifyKey, boolean> | null>(null);
  const notify = pending ?? (server.data ? { ride: server.data.ride, support: server.data.support, offers: server.data.offers } : local);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (server.data) mirrorNotificationPrefs(server.data);
  }, [server.data]);

  const toggle = async (key: NotifyKey, value: boolean) => {
    const next = { ...notify, [key]: value };
    setPending(next);
    try {
      const saved = await setNotificationPrefs(api(), next);
      mirrorNotificationPrefs(saved);
      queryClient.setQueryData(PREFS_KEY, saved);
    } catch (error) {
      toast({ message: errorMessage(error), tone: 'danger' });
    } finally {
      setPending(null);
    }
  };

  const open = (url: string) => url && void WebBrowser.openBrowserAsync(url);

  return (
    <Screen hero={<HeroHeader title={t('settings.title')} onBack={() => router.back()} overlap={space[6]} />}>
      <Card elevated>
        <Text variant="label">{t('profile.language')}</Text>
        <SegmentedControl<Language>
          accessibilityLabel={t('profile.language')}
          segments={[
            { value: 'en', label: 'English' },
            { value: 'bn', label: 'বাংলা' },
          ]}
          value={lang}
          onChange={(next) => {
            setLang(next);
            void setLanguage(next);
          }}
        />
        <Text variant="label">{t('settings.theme')}</Text>
        <SegmentedControl<ThemeMode>
          accessibilityLabel={t('settings.theme')}
          segments={[
            { value: 'system', label: t('settings.system') },
            { value: 'light', label: t('settings.light') },
            { value: 'dark', label: t('settings.dark') },
          ]}
          value={theme.mode}
          onChange={theme.setMode}
        />
      </Card>

      <Card>
        <Text variant="heading">{t('settings.notifications')}</Text>
        {NOTIFY.map((key) => (
          <Row key={key} style={{ justifyContent: 'space-between', minHeight: 52 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t(`settings.notify.${key}`)}</Text>
              <Text variant="caption" color="textMuted">
                {t(`settings.notify.${key}Body`)}
              </Text>
            </View>
            <Switch
              value={notify[key]}
              onValueChange={(v) => void toggle(key, v)}
              accessibilityLabel={t(`settings.notify.${key}`)}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
            />
          </Row>
        ))}
        <Text variant="caption" color="textMuted">
          {t('settings.safetyAlways')}
        </Text>
      </Card>

      <Card padded={false} style={{ padding: space[2] }}>
        <ListRow icon="bookmark" title={t('account.places')} onPress={() => router.push('/places')} />
        <ListRow icon="file-text" title={t('welcome.terms')} onPress={() => open(env().EXPO_PUBLIC_TERMS_URL)} />
        <ListRow icon="lock" title={t('welcome.privacy')} onPress={() => open(env().EXPO_PUBLIC_PRIVACY_URL)} />
        <ListRow icon="info" title={t('settings.version')} value={`${Constants.expoConfig?.version ?? ''} · ${env().EXPO_PUBLIC_APP_ENV}`} />
      </Card>

      <Button
        label={t('settings.signOut')}
        variant="secondary"
        leftIcon="log-out"
        loading={leaving}
        onPress={async () => {
          setLeaving(true);
          await signOut().catch(() => undefined);
          router.replace('/welcome');
        }}
      />
      <Button label={t('settings.delete')} variant="ghost" onPress={() => router.push('/delete-account')} />
    </Screen>
  );
}
