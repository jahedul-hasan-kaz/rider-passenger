import { HindSiliguri_400Regular, HindSiliguri_500Medium, HindSiliguri_600SemiBold, HindSiliguri_700Bold } from '@expo-google-fonts/hind-siliguri';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';

import type { FontWeight } from './tokens';

// Inter for Latin, Hind Siliguri for Bengali (§5.2). Custom fonts ignore `fontWeight` on Android, so each weight is
// its own family and the Text component picks the family instead of setting a weight.

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
};

export type Script = 'latin' | 'bengali';

const LATIN: Record<FontWeight, keyof typeof fontAssets> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
};

// Hind Siliguri has no 800; headlines fall back to 700.
const BENGALI: Record<FontWeight, keyof typeof fontAssets> = {
  '400': 'HindSiliguri_400Regular',
  '500': 'HindSiliguri_500Medium',
  '600': 'HindSiliguri_600SemiBold',
  '700': 'HindSiliguri_700Bold',
  '800': 'HindSiliguri_700Bold',
};

export function fontFamily(weight: FontWeight, script: Script): string {
  return (script === 'bengali' ? BENGALI : LATIN)[weight];
}

const BENGALI_CHARS = /[ঀ-৿]/;

/**
 * When the text is known, its own characters decide (a Latin street name stays in Inter inside the Bengali UI; the
 * "বাংলা" switch uses Hind Siliguri inside the English UI). Otherwise — inputs, nested text — the UI language decides.
 */
export function scriptFor(language: string, text?: string): Script {
  if (text !== undefined && text.trim() !== '') return BENGALI_CHARS.test(text) ? 'bengali' : 'latin';
  return language === 'bn' ? 'bengali' : 'latin';
}

/** Bengali glyphs are taller; give them 15% more line height (§5.2). */
export const BENGALI_LINE_HEIGHT_FACTOR = 1.15;
