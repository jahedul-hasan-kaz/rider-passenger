import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';

// Device storage (docs/spec/01-overview-foundation.md §3, docs/spec/05-quality-delivery.md §12.2).
//
// SecureStore (Keychain / Keystore) holds only a random 256-bit key: its values are limited to ~2 KB, and a Supabase
// session is larger. The key encrypts an MMKV instance that holds the session and other sensitive cache.
// A second, unencrypted MMKV instance holds harmless preferences (language, theme) that must be readable before
// anything else has loaded.

const KEY_NAME = 'rider.secure-mmkv-key.v1';
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

let secure: MMKV | undefined;
let securePromise: Promise<MMKV> | undefined;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Encrypted store for the session and sensitive cache. Created once per launch. */
export function secureStorage(): Promise<MMKV> {
  if (secure) return Promise.resolve(secure);
  securePromise ??= (async () => {
    let key = await SecureStore.getItemAsync(KEY_NAME, KEY_OPTIONS);
    if (!key) {
      // 16 random bytes as 32 hex characters = a 32-byte AES-256 key for MMKV.
      key = toHex(getRandomBytes(16));
      await SecureStore.setItemAsync(KEY_NAME, key, KEY_OPTIONS);
    }
    secure = createMMKV({ id: 'rider.secure', encryptionKey: key, encryptionType: 'AES-256' });
    return secure;
  })();
  return securePromise;
}

/** Plain preferences: never put anything personal or secret here. */
export const prefs: MMKV = createMMKV({ id: 'rider.prefs' });

/** Adapter in the shape Supabase Auth expects for persisting its session. */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    return (await secureStorage()).getString(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    (await secureStorage()).set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    (await secureStorage()).remove(key);
  },
};

/** Wipes everything personal on sign-out or account deletion. Preferences such as language are kept. */
export async function clearSensitiveStorage(): Promise<void> {
  (await secureStorage()).clearAll();
}
