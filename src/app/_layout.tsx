import '@/i18n';

import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { bindSession, useSession } from '@/features/auth/session-store';
import { bindPush, configurePush, registerForPush } from '@/features/push/push';
import { env } from '@/lib/env';
import { initMonitoring, wrapRoot } from '@/lib/monitoring';
import { bindQueryLifecycle, createQueryClient } from '@/lib/query-client';
import { persistOptions } from '@/lib/query-persist';
import { bindAuthRefreshToAppState } from '@/lib/supabase';
import { fontAssets } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { SheetProvider, ToastProvider, useToast } from '@/ui';

void SplashScreen.preventAutoHideAsync();

// Validate configuration once, before anything touches the network. A broken build shows one clear screen instead
// of failing in random places.
let configError: Error | null = null;
try {
  env();
  initMonitoring();
  configurePush();
} catch (error) {
  configError = error instanceof Error ? error : new Error(String(error));
}

function ConfigErrorScreen() {
  const { t } = useTranslation();
  // Plain RN text on purpose: this must render even if fonts or theme failed.
  return (
    <View style={styles.center}>
      <RNText style={styles.title}>{t('boot.configError')}</RNText>
      {__DEV__ && configError ? <RNText style={styles.detail}>{configError.message}</RNText> : null}
    </View>
  );
}

/** Connects pushes to the running app and keeps this device registered while signed in (spec 04 §10). */
function PushBridge() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const signedIn = useSession((s) => s.status === 'signedIn');

  useEffect(() => bindPush(queryClient, (title) => title && toast({ message: title, icon: 'bell' })), [queryClient, toast]);
  useEffect(() => {
    if (signedIn) void registerForPush();
  }, [signedIn]);

  // Signing out must leave nothing of the previous account in memory (the disk copy is wiped with the session).
  const signedOut = useSession((s) => s.status === 'signedOut');
  useEffect(() => {
    if (signedOut) queryClient.clear();
  }, [signedOut, queryClient]);
  return null;
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} />
    </>
  );
}

function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [persist] = useState(persistOptions);
  // A missing font must not block the app forever: render with system fonts if loading fails.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (configError) return;
    const unbind = [bindQueryLifecycle(), bindAuthRefreshToAppState(), bindSession()];
    return () => unbind.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    if (ready || configError) void SplashScreen.hideAsync();
  }, [ready]);

  if (configError) {
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen />
      </SafeAreaProvider>
    );
  }
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={persist}>
            <SheetProvider>
              <ToastProvider>
                <PushBridge />
                <ThemedStack />
              </ToastProvider>
            </SheetProvider>
          </PersistQueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 13, textAlign: 'center', opacity: 0.7 },
});
