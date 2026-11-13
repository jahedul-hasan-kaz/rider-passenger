import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { api } from '@/api';
import { reversePlaceRemote } from '@/api/endpoints/me';

// Foreground location only (docs/spec/03-screens.md §7.4, docs/spec/04-integration.md §11). The passenger app never
// asks for background location; the Android permission is blocked in app.config.ts.

export type Fix = { lat: number; lng: number; accuracy: number | null; at: number };

export type PermissionState = {
  /** `blocked`: denied and the OS will not show the dialog again — only Settings can fix it. */
  status: 'checking' | 'granted' | 'undetermined' | 'denied' | 'blocked';
  /** False when the user granted only approximate location (Android 12+): a pickup pin needs precise. */
  precise: boolean;
  servicesOn: boolean;
};

async function readPermission(): Promise<PermissionState> {
  const [perm, servicesOn] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.hasServicesEnabledAsync().catch(() => true),
  ]);
  const precise = Platform.OS !== 'android' || perm.android?.accuracy !== 'coarse';
  if (perm.granted) return { status: 'granted', precise, servicesOn };
  if (perm.status === 'undetermined') return { status: 'undetermined', precise, servicesOn };
  return { status: perm.canAskAgain ? 'denied' : 'blocked', precise, servicesOn };
}

/** Current permission, re-checked automatically when the app returns to the foreground (e.g. from Settings). */
export function useLocationPermission() {
  const [state, setState] = useState<PermissionState>({ status: 'checking', precise: true, servicesOn: true });

  const recheck = useCallback(async () => {
    const next = await readPermission().catch(() => ({ status: 'denied', precise: true, servicesOn: true }) as PermissionState);
    setState(next);
    return next;
  }, []);

  const request = useCallback(async () => {
    await Location.requestForegroundPermissionsAsync().catch(() => undefined);
    return recheck();
  }, [recheck]);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      readPermission()
        .catch(() => ({ status: 'denied', precise: true, servicesOn: true }) as PermissionState)
        .then((next) => alive && setState(next));
    void refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return { ...state, request, recheck };
}

export class LocationTimeout extends Error {
  constructor() {
    super('location timeout');
    this.name = 'LocationTimeout';
  }
}

/** A fresh, accurate fix within 10 s; falls back to the last known position if it is under 2 minutes old. */
export async function currentFix(timeoutMs = 10_000): Promise<Fix> {
  const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(toFix);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new LocationTimeout()), timeoutMs));
  try {
    return await Promise.race([fresh, timeout]);
  } catch (error) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 }).catch(() => null);
    if (last) return toFix(last);
    throw error;
  }
}

function toFix(position: Location.LocationObject): Fix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    at: position.timestamp,
  };
}

/** "Road 11, Banani" from coordinates: rider-admin's geocoder first, then the phone's; null when neither knows. */
export async function addressLabel(lat: number, lng: number): Promise<{ title: string; subtitle?: string } | null> {
  try {
    const answer = await reversePlaceRemote(api(), { lat, lng });
    const first = answer.results[0];
    if (first) return { title: first.title, subtitle: first.subtitle ?? undefined };
  } catch {
    // Fall through to the device geocoder.
  }
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!address) return null;
    const street = [address.streetNumber, address.street].filter(Boolean).join(' ') || address.name;
    const area = address.district ?? address.subregion ?? address.city;
    const title = [street, area].filter(Boolean).join(', ');
    if (!title) return null;
    return { title, subtitle: [address.city, address.postalCode].filter(Boolean).join(' ') || undefined };
  } catch {
    return null;
  }
}

/** Straight-line distance in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough road estimate for search results only (fares always come from the server): ×1.35 road factor at 25 km/h,
 *  the same defaults rider-admin uses when no routing provider is configured. */
export function roughTrip(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const meters = distanceM(a, b) * 1.35;
  return { meters, seconds: meters / (25_000 / 3600) };
}

/** Where the passenger is right now, shared across screens. */
type LocationStore = { fix: Fix | null; setFix: (fix: Fix) => void };
export const useLastFix = create<LocationStore>((set) => ({ fix: null, setFix: (fix) => set({ fix }) }));
