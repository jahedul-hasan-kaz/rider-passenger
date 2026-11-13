import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { isApiError } from '@/api/errors';
import { prefs } from '@/lib/storage';

import bn from './bn.json';
import en from './en.json';

// English and Bengali from day one (docs/spec/05-quality-delivery.md §12.4). Order of preference: the language the
// user picked in the app, then the device language, then English.

export const LANGUAGES = ['en', 'bn'] as const;
export type Language = (typeof LANGUAGES)[number];

const PREF_KEY = 'language';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function initialLanguage(): Language {
  const saved = prefs.getString(PREF_KEY);
  if (isLanguage(saved)) return saved;
  const device = getLocales()[0]?.languageCode;
  return device === 'bn' ? 'bn' : 'en';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function setLanguage(language: Language): Promise<void> {
  prefs.set(PREF_KEY, language);
  await i18n.changeLanguage(language);
}

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : 'en';
}

/** A user-facing message for any error. Server messages are already localised, but the app's own copy is preferred
 *  so wording stays consistent; the server message is the fallback for codes the app does not know yet. */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return i18n.t('errors.generic');
  const key = `errors.${error.code}`;
  if (i18n.exists(key)) return i18n.t(key, { seconds: error.retryAfterS ?? 60 });
  return error.message && error.message !== error.code ? error.message : i18n.t('errors.generic');
}

export default i18n;
