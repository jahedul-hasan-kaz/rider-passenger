import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAuthFailure } from '@/api/errors';
import { useActiveRide, useMe } from '@/features/account/queries';
import { useSession } from '@/features/auth/session-store';
import { useLocationPermission } from '@/features/location/location';
import { errorMessage } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Button, MapPin, Text } from '@/ui';

// Start-up gate (docs/spec/04-integration.md §8.4): session → profile → role/status → active ride → location → home.
// Every launch and every "go back to the start" lands here and is sent to exactly one place.
export default function Gate() {
  const { t } = useTranslation();
  const session = useSession((s) => s.status);
  const me = useMe();
  const passenger = me.data?.role === 'passenger' && me.data.status === 'active';
  const activeRide = useActiveRide(passenger);
  const permission = useLocationPermission();

  if (session === 'signedOut') return <Redirect href="/welcome" />;

  if (me.error && !isAuthFailure(me.error)) {
    return (
      <Splash>
        <Text color="onHero" align="center">
          {errorMessage(me.error)}
        </Text>
        <Button label={t('common.retry')} variant="accent" onPress={() => void me.refetch()} />
      </Splash>
    );
  }
  if (session === 'loading' || !me.data) return <Splash />;

  if (me.data.status !== 'active') return <Redirect href={{ pathname: '/blocked', params: { reason: me.data.status } }} />;
  if (me.data.role === 'user') return <Redirect href="/name" />;
  if (me.data.role !== 'passenger') return <Redirect href={{ pathname: '/blocked', params: { reason: 'role' } }} />;

  if (activeRide.isPending || permission.status === 'checking') return <Splash />;
  if (activeRide.data) return <Redirect href={{ pathname: '/ride/[id]', params: { id: activeRide.data.id } }} />;
  if (permission.status !== 'granted') return <Redirect href="/location" />;
  return <Redirect href="/home" />;
}

function Splash({ children }: { children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.splash, { backgroundColor: colors.hero }]}>
      {children ?? <MapPin pulsing />}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[4] },
});
