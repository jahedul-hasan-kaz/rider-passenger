import { pathForPush, safeAppPath } from '../deep-links';

const ID = '3f2a9c1e-8b7d-4e6f-9a1b-2c3d4e5f6a7b';

describe('safeAppPath', () => {
  it.each([
    [`riderpassenger://ride/${ID}`, `/ride/${ID}`],
    [`riderpassenger-dev://receipt/${ID}?utm=x#top`, `/receipt/${ID}`],
    [`https://rider.example/ride/${ID}`, `/ride/${ID}`],
    [`/support/${ID.toUpperCase()}/`, `/support/${ID}`],
    ['riderpassenger://home', '/home'],
    ['/', '/'],
  ])('allows %s', (link, expected) => {
    expect(safeAppPath(link)).toBe(expected);
  });

  it.each([
    'riderpassenger://ride/not-a-uuid',
    'riderpassenger://delete-account',
    '/(app)/home',
    '/dev/gallery',
    `/ride/${ID}/../../settings`,
    'javascript:alert(1)',
    '',
    null,
  ])('refuses %s', (link) => {
    expect(safeAppPath(link)).toBeNull();
  });
});

describe('pathForPush', () => {
  it('prefers a valid url, then falls back to type + id', () => {
    expect(pathForPush({ type: 'ride.driver_arrived', url: `riderpassenger://ride/${ID}` })).toBe(`/ride/${ID}`);
    expect(pathForPush({ type: 'ride.driver_assigned', ride_id: ID })).toBe(`/ride/${ID}`);
    expect(pathForPush({ type: 'ride.completed', ride_id: ID })).toBe(`/complete/${ID}`);
    expect(pathForPush({ type: 'support.reply', ticket_id: ID })).toBe(`/support/${ID}`);
    expect(pathForPush({ type: 'safety.update' })).toBe('/safety');
  });

  it('ignores a bad url and bad ids', () => {
    expect(pathForPush({ type: 'ride.started', url: 'https://evil.example/x', ride_id: 'nope' })).toBeNull();
    expect(pathForPush({ type: 'unknown.event' })).toBeNull();
    expect(pathForPush(null)).toBeNull();
  });
});

