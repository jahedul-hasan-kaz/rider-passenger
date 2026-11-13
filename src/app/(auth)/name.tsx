import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { onboardPassenger } from '@/api/endpoints/care';
import { recordConsent } from '@/api/endpoints/me';
import { TERMS_VERSION } from '@/features/auth/auth';
import { keys } from '@/features/account/queries';
import { errorMessage } from '@/i18n';
import { track } from '@/lib/analytics';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, HeroHeader, Screen, StepIndicator, Text, TextField } from '@/ui';

// Name shown to drivers (docs/spec/03-screens.md §7.3): only for new accounts. Completing it turns the account into
// a passenger account (`POST /onboarding/passenger`).
export default function NameScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 120;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await intents().run('onboarding.passenger', (key) => onboardPassenger(api(), trimmed, key));
      // The terms accepted on the welcome screen, recorded on the account (gap B13). Never blocks onboarding.
      await intents()
        .run('consent', (key) => recordConsent(api(), TERMS_VERSION, key))
        .catch(() => undefined);
      track('onboarding_step_completed', { step: 'name' });
      await queryClient.invalidateQueries({ queryKey: keys.me });
      router.replace('/');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      hero={
        <HeroHeader title={t('auth.nameTitle')} subtitle={t('auth.nameSub')} overlap={space[6]}>
          <StepIndicator step={2} total={3} />
        </HeroHeader>
      }
      footer={<Button testID="name-continue" label={t('common.continue')} onPress={() => void submit()} loading={busy} disabled={!valid} />}>
      <Card elevated>
        <TextField
          testID="name-input"
          label={t('auth.nameLabel')}
          placeholder={t('auth.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          autoComplete="name"
          textContentType="givenName"
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </Card>
      <Text variant="caption" color="textMuted">
        {t('auth.namePrivacy')}
      </Text>
      {error ? <Banner tone="danger" body={error} /> : null}
    </Screen>
  );
}
