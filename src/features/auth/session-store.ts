import { create } from 'zustand';

import { setMonitoringUser } from '@/lib/monitoring';
import { clearSensitiveStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { usePlaces } from '../places/places-store';

// Who is signed in, mirrored from Supabase Auth. The session itself lives in encrypted storage (lib/storage.ts);
// this store only tells the UI which branch of navigation to show.

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: SessionStatus;
  userId: string | null;
};

export const useSession = create<SessionState>(() => ({ status: 'loading', userId: null }));

function apply(userId: string | null) {
  useSession.setState({ status: userId ? 'signedIn' : 'signedOut', userId });
  setMonitoringUser(userId);
}

/** Starts mirroring the auth session; returns the unsubscribe function. */
export function bindSession(): () => void {
  void supabase()
    .auth.getSession()
    .then(({ data }) => apply(data.session?.user.id ?? null))
    .catch(() => apply(null));
  const { data } = supabase().auth.onAuthStateChange((event, session) => {
    apply(session?.user.id ?? null);
    if (event === 'SIGNED_OUT') {
      void clearSensitiveStorage();
      usePlaces.getState().clear();
    }
  });
  return () => data.subscription.unsubscribe();
}
