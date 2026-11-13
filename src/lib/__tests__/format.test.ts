import { formatDistance, formatDuration, formatMoney, groupDigits } from '../format';
import { formatNational, isValidNational, maskE164, toE164, toNationalDigits } from '../phone';

describe('formatMoney', () => {
  it.each([
    ['190.00', '৳190'],
    ['190.50', '৳190.50'],
    ['0.00', '৳0'],
    ['-20.00', '−৳20'],
    ['-0.00', '৳0'],
    ['125000.00', '৳1,25,000'],
    ['1234567.25', '৳12,34,567.25'],
  ])('%s → %s', (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });

  it('can use Bengali digits', () => {
    expect(formatMoney('190.00', { bengaliDigits: true })).toBe('৳১৯০');
  });

  it('leaves unexpected input untouched rather than inventing a number', () => {
    expect(formatMoney('n/a')).toBe('n/a');
  });

  it('groups digits the South Asian way', () => {
    expect(groupDigits('100000')).toBe('1,00,000');
    expect(groupDigits('999')).toBe('999');
  });
});

describe('formatDistance and formatDuration', () => {
  it('formats distances', () => {
    expect(formatDistance(846)).toBe('850 m');
    expect(formatDistance(6200)).toBe('6.2 km');
    expect(formatDistance(6000)).toBe('6 km');
    expect(formatDistance(12_400)).toBe('12 km');
    expect(formatDistance(6200, 'bn')).toBe('6.2 কিমি');
  });

  it('rounds durations up and never shows zero', () => {
    expect(formatDuration(0)).toBe('1 min');
    expect(formatDuration(61)).toBe('2 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(1320, 'bn', { bengaliDigits: true })).toBe('২২ মিনিট');
  });
});

describe('phone', () => {
  it.each(['01712345678', '+8801712345678', '8801712345678', '1712 345 678', '+880 17-1234-5678'])('normalises %s', (input) => {
    expect(toNationalDigits(input)).toBe('1712345678');
  });

  it('validates operator prefixes', () => {
    expect(isValidNational('1712345678')).toBe(true);
    expect(isValidNational('1212345678')).toBe(false);
    expect(isValidNational('171234567')).toBe(false);
  });

  it('formats, converts and masks', () => {
    expect(formatNational('1712345')).toBe('17 1234 5');
    expect(formatNational('1712345678')).toBe('17 1234 5678');
    expect(toE164('1712345678')).toBe('+8801712345678');
    expect(toE164('12')).toBeNull();
    expect(maskE164('+8801712345645')).toBe('+880 17•• ••••45');
  });
});
