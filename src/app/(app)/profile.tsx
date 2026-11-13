import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';
import { getMe } from '@/api/endpoints/account';
import { updateMe } from '@/api/endpoints/care';
import { isApiErrorCode } from '@/api/errors';
import { keys, useMe } from '@/features/account/queries';
import { randomUUID } from 'expo-crypto';
import { currentLanguage, errorMessage, setLanguage, type Language } from '@/i18n';
import { maskE164 } from '@/lib/phone';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, HeroHeader, ListRow, Screen, SegmentedControl, Text, TextField, useToast } from '@/ui';

// Profile (docs/spec/03-screens.md §7.16): name shown to drivers, language. The phone number is read-only.
export default function Profile() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const me = useMe();
  // null = untouched: show the saved name until the passenger edits it.
  const [edited, setName] = useState<string | null>(null);
  const name = edited ?? me.data?.full_name ?? '';
  const [lang, setLang] = useState<Language>(currentLanguage());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !!me.data && (name.trim() !== (me.data.full_name ?? '') || lang !== me.data.preferred_language);
  const valid = name.trim().length >= 1 && name.trim().length <= 120;

  const save = async () => {
    if (!me.data) return;
    setBusy(true);
    setError(null);
    const attempt = (version: number) => updateMe(api(), { fullName: name, language: lang, expectedVersion: version }, randomUUID());
    try {
      try {
        await attempt(me.data.version);
      } catch (failure) {
        // Changed elsewhere since we loaded it: reload once and apply this edit on top.
        if (!isApiErrorCode(failure, 'STALE_VERSION')) throw failure;
        const fresh = await queryClient.fetchQuery({ queryKey: keys.me, queryFn: () => getMe(api()), staleTime: 0 });
        await attempt(fresh.version);
      }
      await setLanguage(lang);
      await queryClient.invalidateQueries({ queryKey: keys.me });
      toast({ message: t('profile.saved'), tone: 'success' });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      hero={<HeroHeader title={t('profile.title')} onBack={() => router.back()} overlap={space[6]} />}
      footer={<Button label={t('profile.save')} onPress={() => void save()} loading={busy} disabled={!dirty || !valid} />}>
      <Card elevated>
        <TextField label={t('auth.nameLabel')} value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" helper={t('auth.namePrivacy')} />
        <ListRow icon="phone" title={t('profile.phone')} subtitle={me.data?.phone ? maskE164(me.data.phone) : t('profile.noPhone')} />
        <Text variant="label">{t('profile.language')}</Text>
        <SegmentedControl<Language>
          accessibilityLabel={t('profile.language')}
          segments={[
            { value: 'en', label: 'English' },
            { value: 'bn', label: 'বাংলা' },
          ]}
          value={lang}
          onChange={setLang}
        />
      </Card>
      {error ? <Banner tone="danger" body={error} /> : null}
    </Screen>
  );
}
