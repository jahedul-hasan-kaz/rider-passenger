import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { devSignInWithPassword } from '@/features/auth/auth';
import { authMessage } from '@/features/auth/messages';
import { Banner, Button, Card, HeroHeader, Screen, TextField } from '@/ui';

// Development builds only: sign in to a staging demo account with email and password while phone sign-up is
// switched off in rider-admin (gap B1). The password is typed each time and never stored by the app.
export default function DevSignIn() {
  if (!__DEV__) return <Redirect href="/welcome" />;
  return <DevSignInForm />;
}

function DevSignInForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await devSignInWithPassword(email, password);
      router.replace('/');
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      hero={<HeroHeader title={t('auth.devSignIn')} subtitle={t('auth.devSignInSub')} onBack={() => router.back()} />}
      footer={<Button testID="dev-sign-in-submit" label={t('auth.signIn')} onPress={() => void submit()} loading={busy} disabled={!email.includes('@') || password.length < 6} />}>
      <Card elevated>
        <TextField testID="dev-email" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextField testID="dev-password" label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      </Card>
      {error ? <Banner tone="danger" body={error} /> : null}
    </Screen>
  );
}
