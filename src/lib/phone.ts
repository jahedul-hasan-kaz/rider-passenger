// Bangladeshi mobile numbers (docs/spec/03-screens.md §7.2). The prefix +880 is fixed in v1; the field holds the
// 10 national digits after it (`1712345678`). Pasted numbers in any common form are normalised.

/** Valid national part: 1, then an operator digit 3–9, then 8 digits. */
const NATIONAL = /^1[3-9]\d{8}$/;

/** Extracts the 10 national digits from `01712345678`, `+8801712345678`, `8801712345678`, `1712 345 678`, … */
export function toNationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isValidNational(digits: string): boolean {
  return NATIONAL.test(digits);
}

/** `1712345678` → `+8801712345678` (E.164), or null when invalid. */
export function toE164(national: string): string | null {
  return isValidNational(national) ? `+880${national}` : null;
}

/** Display grouping as the user types: `17 1234 5678`. */
export function formatNational(digits: string): string {
  const d = digits.slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6)].filter(Boolean).join(' ');
}

/** `rahim.k@gmail.com` → `ra•••@gmail.com`: recognisable, not copyable. */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}•••@${domain}`;
}

/** `+8801712345678` → `+880 17•• ••••78`: enough to recognise, not enough to copy (code screen, §7.3). */
export function maskE164(e164: string): string {
  const national = toNationalDigits(e164);
  if (national.length !== 10) return e164;
  return `+880 ${national.slice(0, 2)}•• ••••${national.slice(8)}`;
}
