import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';
import { getMe } from '@/api/endpoints/account';
import { keys } from '@/features/account/queries';
import { AuthFailure, sendCodeTo, verifyCodeFor, type CodeTarget } from '@/features/auth/auth';
import { authMessage } from '@/features/auth/messages';
import { errorMessage } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { maskE164, maskEmail } from '@/lib/phone';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, HeroHeader, OtpInput, Row, Screen, StepIndicator, Text } from '@/ui';

const RESEND_S = 30;

/** When the next code may be requested. Read only in event handlers and state initialisers, never during render. */
const nextResendAt = () => Date.now() + RESEND_S * 1000;

// Enter the code (docs/spec/03-screens.md §7.3, mockup 3). New accounts continue to the name step; returning
// passengers go straight on.
export default function CodeScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // The code went either to a phone number (SMS) or to an email address.
  const { phone, email } = useLocalSearchParams<{ phone?: string; email?: string }>();
  const target: CodeTarget | null = email ? { channel: 'email', email } : phone ? { channel: 'sms', phone } : null;
  const sentTo = target?.channel === 'email' ? maskEmail(target.email) : target ? maskE164(target.phone) : '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [expired, setExpired] = useState(false);
  const [resendAt, setResendAt] = useState(nextResendAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const verify = async (value = code) => {
    if (value.length !== 6 || busy || !target) return;
    setBusy(true);
    setError(undefined);
    try {
      await verifyCodeFor(target, value);
      haptic('driverFound');
      track('onboarding_step_completed', { step: 'code' });
      const me = await queryClient.fetchQuery({ queryKey: keys.me, queryFn: () => getMe(api()) });
      router.replace(me.role === 'user' ? '/name' : '/');
    } catch (failure) {
      haptic('error');
      setCode('');
      setExpired(failure instanceof AuthFailure && failure.problem === 'codeExpired');
      setError(failure instanceof AuthFailure ? authMessage(failure) : errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!target || wait > 0) return;
    setError(undefined);
    setExpired(false);
    try {
      await sendCodeTo(target);
      setResendAt(nextResendAt());
    } catch (failure) {
      setError(authMessage(failure));
    }
  };

  return (
    <Screen
      hero={
        <HeroHeader
          title={t('auth.codeTitle')}
          onBack={() => router.back()}
          overlap={space[6]}
          subtitle={
            <Row gap={2}>
              <Text color="onHeroMuted">{t(target?.channel === 'email' ? 'auth.sentToEmail' : 'auth.sentTo', { phone: sentTo })}</Text>
              <Text color="onHero" weight="700" onPress={() => router.back()} accessibilityRole="link" style={styles.link}>
                {t('auth.edit')}
              </Text>
            </Row>
          }>
          <StepIndicator step={2} total={3} />
        </HeroHeader>
      }
      footer={<Button testID="verify" label={t('auth.verify')} onPress={() => void verify()} loading={busy} disabled={code.length !== 6} />}>
      <Card elevated>
        <View style={styles.stack}>
          <OtpInput
            testID="otp-input"
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(undefined);
            }}
            onComplete={(value) => void verify(value)}
            error={!!error}
          />
          {error ? <Banner tone="danger" body={error} /> : null}
          <Row style={styles.between}>
            <Text variant="caption" color="textMuted">
              {t('auth.didntGetIt')}
            </Text>
            {wait > 0 ? (
              <Text variant="caption" color="textMuted" tabular>
                {t('auth.resendIn', { time: `0:${String(wait).padStart(2, '0')}` })}
              </Text>
            ) : (
              <Button label={t('auth.resend')} variant={expired ? 'primary' : 'ghost'} size="md" fullWidth={false} onPress={() => void resend()} />
            )}
          </Row>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  between: { justifyContent: 'space-between', minHeight: 48 },
  link: { textDecorationLine: 'underline' },
});
