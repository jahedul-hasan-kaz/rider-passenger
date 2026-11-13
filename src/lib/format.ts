// Display formatting (§5.2). Fares are formatted `৳190`; amounts arrive as 2-dp strings from the API and are never
// recomputed here — only grouped and trimmed. Latin digits are the default in both languages (decision D8).

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/** South Asian grouping: 1,00,000 rather than 100,000. */
export function groupDigits(whole: string): string {
  if (whole.length <= 3) return whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export type NumberOptions = { bengaliDigits?: boolean };

/**
 * `"190.00"` → `৳190`, `"190.50"` → `৳190.50`, `"-20.00"` → `−৳20`, `"125000.00"` → `৳1,25,000`.
 * Accepts the normalised money string produced by `api/schemas.ts#money`.
 */
export function formatMoney(amount: string, options: NumberOptions = {}): string {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return amount;
  const [, minus, whole, fraction = ''] = match;
  const cents = (fraction + '00').slice(0, 2);
  const body = `৳${groupDigits(String(Number(whole)))}${cents === '00' ? '' : `.${cents}`}`;
  const text = minus && (Number(whole) > 0 || cents !== '00') ? `−${body}` : body;
  return options.bengaliDigits ? toBengaliDigits(text) : text;
}

type Units = { km: string; m: string; min: string; h: string };

const UNITS: Record<'en' | 'bn', Units> = {
  en: { km: 'km', m: 'm', min: 'min', h: 'h' },
  bn: { km: 'কিমি', m: 'মি', min: 'মিনিট', h: 'ঘণ্টা' },
};

function digits(text: string, options: NumberOptions) {
  return options.bengaliDigits ? toBengaliDigits(text) : text;
}

/** 850 → "850 m", 6200 → "6.2 km", 12000 → "12 km". */
export function formatDistance(meters: number, language: 'en' | 'bn' = 'en', options: NumberOptions = {}): string {
  const u = UNITS[language];
  if (meters < 1000) return digits(`${Math.max(0, Math.round(meters / 10) * 10)} ${u.m}`, options);
  const km = meters / 1000;
  const text = km < 10 ? km.toFixed(1).replace(/\.0$/, '') : String(Math.round(km));
  return digits(`${text} ${u.km}`, options);
}

/** Rounds up to whole minutes (an ETA should never under-promise): 61 → "2 min", 3900 → "1 h 5 min". */
export function formatDuration(seconds: number, language: 'en' | 'bn' = 'en', options: NumberOptions = {}): string {
  const u = UNITS[language];
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return digits(`${minutes} ${u.min}`, options);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return digits(m === 0 ? `${h} ${u.h}` : `${h} ${u.h} ${m} ${u.min}`, options);
}
