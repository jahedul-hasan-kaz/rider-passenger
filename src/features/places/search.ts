import * as Location from 'expo-location';

import { api } from '@/api';
import { searchPlacesRemote } from '@/api/endpoints/me';

import type { Place } from '@/api/endpoints/rides';
import { addressLabel } from '@/features/location/location';

import type { RecentPlace, SavedPlace } from './places-store';

// Place search (docs/spec/03-screens.md §7.7). rider-admin's `/places/search` comes first (provider keys stay on the
// server); when it has no provider configured (`source: "none"`) or can't be reached, the phone's own geocoder is
// used instead.

export type PlaceResult = Place & { title: string; subtitle?: string; source: 'saved' | 'recent' | 'search' };

const normalise = (text: string) => text.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();

/** Saved places and recents that match what the passenger typed — instant and offline. */
export function localMatches(query: string, saved: SavedPlace[], recent: RecentPlace[]): PlaceResult[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  const fromSaved: PlaceResult[] = saved
    .filter((p) => normalise(`${p.name ?? ''} ${p.label ?? ''} ${p.kind}`).includes(q))
    .map((p) => ({ lat: p.lat, lng: p.lng, label: p.label, title: p.label ?? p.name ?? p.kind, subtitle: p.subtitle, source: 'saved' }));
  const fromRecent: PlaceResult[] = recent
    .filter((p) => normalise(p.label ?? '').includes(q))
    .map((p) => ({ lat: p.lat, lng: p.lng, label: p.label, title: p.label ?? '', subtitle: p.subtitle, source: 'recent' }));
  return [...fromSaved, ...fromRecent].slice(0, 5);
}

/** Server search first, then the device geocoder. */
export async function remotePlaces(query: string, near: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const answer = await searchPlacesRemote(api(), q, near, signal);
    if (answer.source !== 'none') {
      return answer.results.map((r) => ({ lat: r.lat, lng: r.lng, label: r.title, title: r.title, subtitle: r.subtitle ?? undefined, source: 'search' as const }));
    }
  } catch {
    if (signal?.aborted) return [];
  }
  return devicePlaces(q, signal);
}

/** Device geocoder: candidate coordinates for the text, each labelled by reverse geocoding. Biased to Dhaka. */
async function devicePlaces(q: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  try {
    const hits = await Location.geocodeAsync(/dhaka|ঢাকা/i.test(q) ? q : `${q}, Dhaka, Bangladesh`);
    if (signal?.aborted) return [];
    const labelled = await Promise.all(
      hits.slice(0, 5).map(async (hit) => {
        const label = await addressLabel(hit.latitude, hit.longitude);
        return {
          lat: hit.latitude,
          lng: hit.longitude,
          label: label?.title ?? q,
          title: label?.title ?? q,
          subtitle: label?.subtitle,
          source: 'search' as const,
        };
      }),
    );
    return signal?.aborted ? [] : labelled;
  } catch {
    // Not available (e.g. web preview, or no Play Services geocoder): the screen falls back to "pick on map".
    return [];
  }
}

/** Splits `title` around the first case-insensitive match so the screen can bold it ("**Dhanm**ondi 27"). */
export function highlight(title: string, query: string): [string, string, string] {
  const index = title.toLowerCase().indexOf(query.trim().toLowerCase());
  if (index < 0 || !query.trim()) return [title, '', ''];
  const end = index + query.trim().length;
  return [title.slice(0, index), title.slice(index, end), title.slice(end)];
}
