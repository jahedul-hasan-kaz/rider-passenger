import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sendCode, signInWithGoogle } from '@/features/auth/auth';
import { authMessage } from '@/features/auth/messages';
import { track } from '@/lib/analytics';
import { env } from '@/lib/env';
import { haptic } from '@/lib/haptics';
import { isValidNational, toE164 } from '@/lib/phone';
import { space } from '@/theme/tokens';
import { Button, Card, Chip, Divider, HeroHeader, PhoneField, Row, Screen, StepIndicator, Text } from '@/ui';

// Phone number (docs/spec/03-screens.md §7.2, mockup 2).
export default function PhoneScreen() {
  const { t } = useTranslation();
  const [digits, setDigits] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const valid = isValidNational(digits);

  const submit = async () => {
    setTouched(true);
    const e164 = toE164(digits);
    if (!e164 || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await sendCode(e164);
      haptic('requestSent');
      track('onboarding_step_completed', { step: 'phone' });
      router.push({ pathname: '/code', params: { phone: e164 } });
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

  const fieldError = touched && digits.length > 0 && !valid ? t('auth.invalidPhone') : error;

  return (
    <Screen
      hero={
        <HeroHeader title={t('auth.phoneTitle')} onBack={() => router.back()} overlap={space[6]}>
          <StepIndicator step={1} total={3} />
        </HeroHeader>
      }>
      <Card elevated padded={false} style={styles.fieldCard}>
        <PhoneField
          testID="phone-input"
          value={digits}
          onChangeDigits={(d) => {
            setDigits(d);
            setError(undefined);
          }}
          autoFocus
          error={fieldError}
        />
      </Card>
      <Text variant="caption" color="textMuted">
        {t('auth.phoneHelp')}
      </Text>
      <Row gap={2} style={styles.wrap}>
        <Chip icon="shield" label={t('auth.masking')} />
        <Chip icon="lock" label={t('auth.noPassword')} />
      </Row>
      <Button testID="send-code" label={t('auth.sendCode')} onPress={() => void submit()} loading={sending} disabled={!valid} />
      <Divider label={t('ui.or')} />
      <Button label={t('auth.useEmail')} variant="secondary" leftIcon="mail" onPress={() => router.replace('/email')} />
      {env().EXPO_PUBLIC_GOOGLE_SIGN_IN ? (
        <>
          <Button label={t('auth.google')} variant="secondary" loading={google} onPress={() => void continueWithGoogle()} />
        </>
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
