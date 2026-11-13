import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { isApiErrorCode } from '@/api/errors';
import { requestAccountDeletion } from '@/api/endpoints/care';
import { signOut } from '@/features/auth/auth';
import { errorMessage } from '@/i18n';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, HeroHeader, NumberedRow, Screen, Text, TextField } from '@/ui';

// Delete account (docs/spec/03-screens.md §7.16). Typing the confirmation word prevents accidents; the server refuses
// during an active ride or while money is owed, and the screen says how to resolve it.
export default function DeleteAccount() {
  const { t } = useTranslation();
  const word = t('deleteAccount.word');
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await intents().run('account.delete', (key) => requestAccountDeletion(api(), reason, key));
      await signOut().catch(() => undefined);
      router.replace('/welcome');
    } catch (failure) {
      if (isApiErrorCode(failure, 'ACCOUNT_HAS_DUES')) setError(t('deleteAccount.dues'));
      else if (isApiErrorCode(failure, 'INVALID_STATE_TRANSITION')) setError(t('deleteAccount.activeRide'));
      else setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      hero={<HeroHeader title={t('deleteAccount.title')} onBack={() => router.back()} overlap={space[6]} />}
      footer={
        <Button
          label={t('deleteAccount.confirm')}
          variant="danger"
          loading={busy}
          disabled={typed.trim().toUpperCase() !== word.toUpperCase()}
          onPress={() => void remove()}
        />
      }>
      <Card elevated>
        <Text variant="heading">{t('deleteAccount.whatHappens')}</Text>
        <NumberedRow n={1} text={t('deleteAccount.step1')} />
        <NumberedRow n={2} text={t('deleteAccount.step2')} />
        <NumberedRow n={3} text={t('deleteAccount.step3')} />
      </Card>
      <Card>
        <TextField label={t('deleteAccount.reason')} value={reason} onChangeText={setReason} maxLength={500} multiline />
        <TextField label={t('deleteAccount.typeWord', { word })} value={typed} onChangeText={setTyped} autoCapitalize="characters" />
      </Card>
      {error ? <Banner tone="danger" body={error} /> : null}
    </Screen>
  );
}
