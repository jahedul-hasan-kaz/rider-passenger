import { createMMKV, type MMKV } from 'react-native-mmkv';

// Web build of lib/storage.ts. The product ships on iOS and Android only; the web target exists so the UI can be
// previewed in a browser during development. Browsers have no Keychain/Keystore, so nothing here is encrypted —
// never use a web build with real accounts.

let secure: MMKV | undefined;

export function secureStorage(): Promise<MMKV> {
  secure ??= createMMKV({ id: 'rider.secure' });
  return Promise.resolve(secure);
}

export const prefs: MMKV = createMMKV({ id: 'rider.prefs' });

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

export async function clearSensitiveStorage(): Promise<void> {
  (await secureStorage()).clearAll();
}
