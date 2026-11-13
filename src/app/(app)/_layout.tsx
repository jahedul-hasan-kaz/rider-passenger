import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useMe } from '@/features/account/queries';
import { useSession } from '@/features/auth/session-store';
import { usePlaces } from '@/features/places/places-store';
import { useTheme } from '@/theme/theme';

// Everything behind sign-in. Anyone who is not an active passenger is sent back through the start-up gate.
export default function AppLayout() {
  const { colors } = useTheme();
  const session = useSession((s) => s.status);
  const me = useMe();
  const hydratePlaces = usePlaces((s) => s.hydrate);
  const pathname = usePathname();

  useEffect(() => {
    if (session === 'signedIn') void hydratePlaces();
  }, [session, hydratePlaces]);

  if (session === 'signedOut') return <Redirect href="/welcome" />;
  // Support stays reachable for any signed-in account, so a suspended passenger can still ask for help.
  const helpOnly = pathname.startsWith('/support');
  if (!helpOnly && me.data && (me.data.role !== 'passenger' || me.data.status !== 'active')) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="ride/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="complete/[rideId]" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
