import { create } from 'zustand';

import { api, intents } from '@/api';
import { listPlaces, removePlace, savePlace, type ServerPlace } from '@/api/endpoints/me';
import type { Place } from '@/api/endpoints/rides';
import { secureStorage } from '@/lib/storage';

// Saved places (Home, Office, Other) and recent destinations (docs/spec/03-screens.md §7.7–7.8).
// Saved places live on the account (rider-admin `/me/places`, gap B6); an encrypted copy on the phone keeps them
// usable offline and instant on launch. Recents stay on the phone only.

export type PlaceKind = 'home' | 'office' | 'other';

export type SavedPlace = Place & {
  id: string;
  kind: PlaceKind;
  /** Custom name for "Other". */
  name?: string;
  subtitle?: string;
  driverNote?: string;
  /** Office only: suggest it on weekday mornings. */
  suggestMornings?: boolean;
};

export type RecentPlace = Place & { subtitle?: string; usedAt: number };

const SAVED_KEY = 'places.saved.v2';
const RECENT_KEY = 'places.recent.v1';
const MAX_RECENT = 6;

type PlacesState = {
  ready: boolean;
  saved: SavedPlace[];
  recent: RecentPlace[];
  /** Loads the phone copy, then refreshes from the account. */
  hydrate: () => Promise<void>;
  /** Saves on the account (Home/Office replace the previous one) and updates the phone copy. Throws on failure. */
  save: (place: Omit<SavedPlace, 'id'>) => Promise<SavedPlace>;
  remove: (id: string) => Promise<void>;
  pushRecent: (place: Place & { subtitle?: string }) => Promise<void>;
  clear: () => void;
};

async function write(key: string, value: unknown) {
  (await secureStorage()).set(key, JSON.stringify(value));
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = (await secureStorage()).getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function fromServer(p: ServerPlace): SavedPlace {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name ?? undefined,
    label: p.label,
    subtitle: p.subtitle ?? undefined,
    lat: p.lat,
    lng: p.lng,
    driverNote: p.driver_note ?? undefined,
    suggestMornings: p.suggest_mornings,
  };
}

const sameSpot = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lng - b.lng) < 0.0002;

export const usePlaces = create<PlacesState>((set, get) => ({
  ready: false,
  saved: [],
  recent: [],
  hydrate: async () => {
    if (!get().ready) {
      const [saved, recent] = await Promise.all([read<SavedPlace[]>(SAVED_KEY, []), read<RecentPlace[]>(RECENT_KEY, [])]);
      set({ saved, recent, ready: true });
    }
    try {
      const saved = (await listPlaces(api())).map(fromServer);
      set({ saved });
      await write(SAVED_KEY, saved);
    } catch {
      // Offline or the server is unwell: keep the phone copy.
    }
  },
  save: async (place) => {
    const created = fromServer(
      await intents().run(`place.save:${place.kind}:${place.lat}:${place.lng}:${place.name ?? ''}`, (key) =>
        savePlace(api(), { ...place, label: place.label ?? '' }, key),
      ),
    );
    const others = get().saved.filter((p) => place.kind === 'other' || p.kind !== place.kind);
    const saved = [...others, created];
    set({ saved });
    await write(SAVED_KEY, saved);
    return created;
  },
  remove: async (id) => {
    await removePlace(api(), id);
    const saved = get().saved.filter((p) => p.id !== id);
    set({ saved });
    await write(SAVED_KEY, saved);
  },
  pushRecent: async (place) => {
    const recent = [{ ...place, usedAt: Date.now() }, ...get().recent.filter((r) => !sameSpot(r, place))].slice(0, MAX_RECENT);
    set({ recent });
    await write(RECENT_KEY, recent);
  },
  // Sign-out wipes the encrypted store; this clears the in-memory copy.
  clear: () => set({ saved: [], recent: [], ready: false }),
}));

export function savedOfKind(saved: SavedPlace[], kind: 'home' | 'office'): SavedPlace | undefined {
  return saved.find((p) => p.kind === kind);
}
