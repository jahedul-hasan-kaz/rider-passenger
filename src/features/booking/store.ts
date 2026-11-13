import { create } from 'zustand';

import type { Place } from '@/api/endpoints/rides';
import { prefs } from '@/lib/storage';

// The ride being planned (Home → Plan → Confirm). Kept in memory: a booking draft is short-lived, and anything
// personal that must survive a restart (saved places, recents) lives in encrypted storage instead.

const LAST_CATEGORY = 'booking.lastCategory';

export type BookingDraft = {
  pickup: Place | null;
  /** True once the passenger moved the pickup themselves; GPS updates then stop overwriting it. */
  pickupPinned: boolean;
  destination: Place | null;
  categoryId: string | null;
  pickupNote: string;
  paymentMethod: string;
  setPickup: (place: Place, pinned?: boolean) => void;
  setDestination: (place: Place | null) => void;
  setCategory: (id: string) => void;
  setPickupNote: (note: string) => void;
  swap: () => void;
  reset: () => void;
};

export const useBooking = create<BookingDraft>((set, get) => ({
  pickup: null,
  pickupPinned: false,
  destination: null,
  categoryId: prefs.getString(LAST_CATEGORY) ?? null,
  pickupNote: '',
  paymentMethod: 'cash',
  setPickup: (place, pinned = true) => {
    if (!pinned && get().pickupPinned) return;
    set({ pickup: place, pickupPinned: pinned });
  },
  setDestination: (place) => set({ destination: place }),
  setCategory: (id) => {
    prefs.set(LAST_CATEGORY, id);
    set({ categoryId: id });
  },
  setPickupNote: (note) => set({ pickupNote: note.slice(0, 300) }),
  swap: () => {
    const { pickup, destination } = get();
    if (!pickup || !destination) return;
    set({ pickup: destination, destination: pickup, pickupPinned: true });
  },
  reset: () => set({ destination: null, pickupNote: '', pickupPinned: false }),
}));
