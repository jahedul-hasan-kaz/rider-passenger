import { money } from '@/api/schemas';

import { REDACTED, scrubEvent, scrubString, scrubUrl, scrubValue } from '../scrub';

describe('scrub', () => {
  it('removes phone numbers, emails and tokens from text', () => {
    const text = scrubString('Call +8801712345678 or 01812345678, mail a@b.co, Bearer abc.def.ghi');
    expect(text).not.toMatch(/1712345678|1812345678|a@b\.co|abc\.def/);
  });

  it('redacts sensitive keys at any depth and drops query strings', () => {
    const out = scrubValue({ pickup: { lat: 23.7, lng: 90.4, label: 'House 42' }, status: 'searching', url: '/zones/check?lat=1&lng=2' });
    expect(out).toEqual({ pickup: { lat: REDACTED, lng: REDACTED, label: REDACTED }, status: 'searching', url: `/zones/check?${REDACTED}` });
    expect(scrubUrl('https://x.test/a')).toBe('https://x.test/a');
  });

  it('keeps only the user id and strips request headers and bodies', () => {
    const event = scrubEvent({
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
      request: { url: 'https://x.test/me?x=1', headers: { Authorization: 'Bearer t' }, data: '{"phone":"01712345678"}' },
    });
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.request).toMatchObject({ url: `https://x.test/me?${REDACTED}`, headers: undefined, data: REDACTED });
  });
});

describe('money', () => {
  it.each([
    [190, '190.00'],
    ['190', '190.00'],
    ['12.5', '12.50'],
    [-20, '-20.00'],
  ])('normalises %p to %p', (input, expected) => {
    expect(money.parse(input)).toBe(expected);
  });

  it('rejects non-numeric text', () => {
    expect(money.safeParse('৳190').success).toBe(false);
  });
});
