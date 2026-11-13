import { isApiError, isTransient } from './errors';

// One idempotency key per *user intent* (docs/spec/04-integration.md §8.1): "request this ride", "cancel ride X",
// "rate trip Y". The key is created on the first attempt and reused for every retry — including a manual "Try again"
// after a network failure — until the server gives a final answer. A final answer (success, or an error that is not
// transient) settles the intent, so the next deliberate action gets a fresh key.
//
// Changing the request body means a new intent: the server rejects a reused key with a different body
// (IDEMPOTENCY_KEY_REUSED), so callers include whatever makes the body unique in the intent name when needed.

export type KeyStore = {
  get(intent: string): string | undefined;
  set(intent: string, key: string): void;
  delete(intent: string): void;
};

export function memoryKeyStore(): KeyStore {
  const keys = new Map<string, string>();
  return {
    get: (intent) => keys.get(intent),
    set: (intent, key) => void keys.set(intent, key),
    delete: (intent) => void keys.delete(intent),
  };
}

export type Intents = {
  /** The key for this intent, created on first use. */
  keyFor(intent: string): string;
  /** Forget the key (the intent reached a final answer). */
  settle(intent: string): void;
  /** Runs `call` with the intent's key and settles it unless the failure was transient (so a retry reuses the key). */
  run<T>(intent: string, call: (idempotencyKey: string) => Promise<T>): Promise<T>;
};

export function createIntents(newId: () => string, store: KeyStore = memoryKeyStore()): Intents {
  function keyFor(intent: string): string {
    const existing = store.get(intent);
    if (existing) return existing;
    const key = newId();
    store.set(intent, key);
    return key;
  }

  function settle(intent: string) {
    store.delete(intent);
  }

  async function run<T>(intent: string, call: (idempotencyKey: string) => Promise<T>): Promise<T> {
    try {
      const result = await call(keyFor(intent));
      settle(intent);
      return result;
    } catch (error) {
      if (!(isApiError(error) && isTransient(error))) settle(intent);
      throw error;
    }
  }

  return { keyFor, settle, run };
}
