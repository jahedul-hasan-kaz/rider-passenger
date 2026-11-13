import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sendEmailCode, signInWithGoogle } from '@/features/auth/auth';
import { authMessage } from '@/features/auth/messages';
import { track } from '@/lib/analytics';
import { env } from '@/lib/env';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme/tokens';
import { Button, Card, Chip, Divider, HeroHeader, Icon, Row, Screen, StepIndicator, Text, TextField } from '@/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Email sign-in: a 6-digit code is emailed and verified on the next screen. Always available, so the app works
// without an SMS gateway; phone sign-in is offered alongside when it is switched on.
export default function EmailScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const value = email.trim().toLowerCase();
  const valid = EMAIL.test(value) && value.length <= 254;

  const submit = async () => {
    setTouched(true);
    if (!valid || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await sendEmailCode(value);
      haptic('requestSent');
      track('onboarding_step_completed', { step: 'email' });
      router.push({ pathname: '/code', params: { email: value } });
    } catch (failure) {
      haptic('error');
      setError(authMessage(failure));
    } finally {
      setSending(false);
    }
  };

  const continueWithGoogle = async () => {
    setGoogle(true);
    setError(undefined);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      setGoogle(false);
    }
  };

  const fieldError = touched && value.length > 0 && !valid ? t('auth.invalidEmail') : error;

  return (
    <Screen
      hero={
        <HeroHeader title={t('auth.emailTitle')} onBack={() => router.back()} overlap={space[6]}>
          <StepIndicator step={1} total={3} />
        </HeroHeader>
      }>
      <Card elevated padded={false} style={styles.fieldCard}>
        <TextField
          testID="email-input"
          size="lg"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(undefined);
          }}
          autoFocus
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="name@example.com"
          accessibilityLabel={t('auth.email')}
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          maxLength={254}
          error={fieldError}
          left={<Icon name="mail" size={20} color="textMuted" />}
        />
      </Card>
      <Text variant="caption" color="textMuted">
        {t('auth.emailHelp')}
      </Text>
      <Row gap={2} style={styles.wrap}>
        <Chip icon="lock" label={t('auth.noPassword')} />
        <Chip icon="shield" label={t('auth.emailPrivate')} />
      </Row>
      <Button testID="send-email-code" label={t('auth.sendCode')} onPress={() => void submit()} loading={sending} disabled={!valid} />
      {env().EXPO_PUBLIC_PHONE_SIGN_IN || env().EXPO_PUBLIC_GOOGLE_SIGN_IN ? <Divider label={t('ui.or')} /> : null}
      {env().EXPO_PUBLIC_PHONE_SIGN_IN ? (
        <Button label={t('auth.usePhone')} variant="secondary" leftIcon="smartphone" onPress={() => router.replace('/phone')} />
      ) : null}
      {env().EXPO_PUBLIC_GOOGLE_SIGN_IN ? (
        <Button label={t('auth.google')} variant="secondary" loading={google} onPress={() => void continueWithGoogle()} />
      ) : null}
      {__DEV__ ? (
        <View style={styles.dev}>
          <Button testID="dev-sign-in-link" label={t('auth.devSignIn')} variant="ghost" size="md" onPress={() => router.push('/dev-sign-in')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldCard: { padding: space[1] },
  wrap: { flexWrap: 'wrap' },
  dev: { alignItems: 'center' },
});
