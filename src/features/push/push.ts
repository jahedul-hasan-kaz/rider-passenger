import type { QueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';

import { api } from '@/api';
import { registerDevice } from '@/api/endpoints/care';
import { keys, refreshAfterRideChange } from '@/features/account/queries';
import { pathForPush, type PushData } from '@/lib/deep-links';
import { reportError } from '@/lib/monitoring';
import { prefs } from '@/lib/storage';

// Expo push (docs/spec/04-integration.md §10). A push is never trusted as state: it only says "look again", and the
// app refetches. Delivery from the server needs rider-admin's Expo adapter and passenger events (gaps B2–B3).

const TOKEN_KEY = 'push.token';
const ASKED_KEY = 'push.asked';

export type PushCategory = 'ride' | 'support' | 'safety' | 'offers';

/** Android channels: the user can tune each one in system settings. */
const CHANNELS: Record<PushCategory, Notifications.NotificationChannelInput> = {
  ride: { name: 'Ride updates', importance: AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 150, 250] },
  support: { name: 'Support', importance: AndroidImportance.DEFAULT },
  safety: { name: 'Safety', importance: AndroidImportance.MAX, sound: 'default', bypassDnd: true },
  offers: { name: 'Offers', importance: AndroidImportance.LOW },
};

export function categoryOf(type: string | undefined): PushCategory {
  if (!type) return 'ride';
  if (type.startsWith('support.')) return 'support';
  if (type.startsWith('safety.')) return 'safety';
  if (type.startsWith('promo.')) return 'offers';
  return 'ride';
}

/** The user's choices in Settings (stored on this phone until gap B4). Safety can never be turned off. */
export function categoryEnabled(category: PushCategory): boolean {
  if (category === 'safety') return true;
  const value = prefs.getString(`notify.${category}`);
  return category === 'offers' ? value === 'on' : value !== 'off';
}

function dataOf(notification: Notifications.Notification): PushData {
  return (notification.request.content.data ?? {}) as PushData;
}

let onForeground: ((title: string, data: PushData) => void) | null = null;

/** Call once at start-up (outside React). */
export function configurePush(): void {
  // Push is phone-only; the web build exists just to preview screens.
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = dataOf(notification);
      const category = categoryOf(data.type);
      const allowed = categoryEnabled(category);
      // In the foreground, ride screens update themselves; a banner would only repeat what is on screen.
      const banner = allowed && category !== 'ride';
      if (allowed && category === 'ride') onForeground?.(notification.request.content.title ?? '', data);
      return { shouldShowBanner: banner, shouldShowList: allowed, shouldPlaySound: banner, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    for (const [id, channel] of Object.entries(CHANNELS)) void Notifications.setNotificationChannelAsync(id, channel);
  }
}

/** Ask for permission in context — right after the first ride request (§10.1), never on first launch. */
export async function askPermissionInContext(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (prefs.getString(ASKED_KEY) === 'yes' || !current.canAskAgain) return false;
  prefs.set(ASKED_KEY, 'yes');
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export function storedPushToken(): string | null {
  return prefs.getString(TOKEN_KEY) ?? null;
}

/** Registers this device's Expo token with rider-admin. Silent no-op without permission, on simulators or without
 *  an EAS project id (local development before `eas init`). */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice || Platform.OS === 'web') return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(api(), Platform.OS === 'ios' ? 'ios' : 'android', token);
    prefs.set(TOKEN_KEY, token);
  } catch (error) {
    reportError(error, { where: 'registerForPush' });
  }
}

export function forgetPushToken(): void {
  prefs.remove(TOKEN_KEY);
}

function open(data: PushData) {
  const path = pathForPush(data);
  // Validated against the deep-link allow-list, so it is a real route.
  if (path) router.push(path as Href);
}

/**
 * Wires pushes into the running app: refetch what a push refers to, show a toast for ride events in the foreground,
 * open the right screen on tap (including a tap that cold-started the app), and re-register rotated tokens.
 */
export function bindPush(queryClient: QueryClient, toast: (title: string, data: PushData) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  onForeground = toast;

  const refresh = (data: PushData) => {
    if (data.ride_id) refreshAfterRideChange(queryClient, data.ride_id);
    if (data.ticket_id) {
      void queryClient.invalidateQueries({ queryKey: keys.tickets });
      void queryClient.invalidateQueries({ queryKey: keys.ticket(data.ticket_id) });
    }
  };

  const received = Notifications.addNotificationReceivedListener((n) => refresh(dataOf(n)));
  const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = dataOf(response.notification);
    refresh(data);
    open(data);
  });
  const rotated = Notifications.addPushTokenListener(() => void registerForPush());

  // A tap that launched the app from a killed state.
  Promise.resolve()
    .then(() => Notifications.getLastNotificationResponseAsync())
    .then((response) => {
      if (response) open(dataOf(response.notification));
    })
    .catch((error: unknown) => reportError(error, { where: 'lastNotificationResponse' }));

  return () => {
    onForeground = null;
    received.remove();
    tapped.remove();
    rotated.remove();
  };
}
