// Deep links (docs/spec/05-quality-delivery.md §12.2): only known screens, with ids that look like ids. Anything else
// — from a notification, another app or a web page — goes to the start-up gate instead of a half-loaded screen.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const ALLOWED: RegExp[] = [
  /^\/$/,
  /^\/home$/,
  /^\/wallet$/,
  /^\/history$/,
  /^\/safety$/,
  /^\/support$/,
  /^\/account$/,
  new RegExp(`^/ride/${UUID}$`, 'i'),
  new RegExp(`^/complete/${UUID}$`, 'i'),
  new RegExp(`^/receipt/${UUID}$`, 'i'),
  new RegExp(`^/support/${UUID}$`, 'i'),
];

/**
 * Turns any incoming link (`riderpassenger://ride/<id>`, `/ride/<id>?x=1`, `https://…/ride/<id>`) into a safe
 * in-app path, or null. Query strings and fragments are dropped: no screen needs them from outside.
 */
export function safeAppPath(link: string | null | undefined): string | null {
  if (!link) return null;
  let path = link.trim();
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(path);
  if (scheme) {
    path = path.slice(scheme[0].length);
    // `scheme://host/path` (web/universal links) vs `scheme://path` (custom scheme, first segment is the route).
    path = /^https?:\/\//i.test(link.trim()) ? path.slice(path.indexOf('/') === -1 ? path.length : path.indexOf('/')) : `/${path}`;
  }
  path = path.split(/[?#]/)[0] ?? '';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
  // Expo Router route groups never appear in public links.
  if (path.includes('(') || path.includes('..')) return null;
  return ALLOWED.some((pattern) => pattern.test(path)) ? path.toLowerCase() : null;
}

export type PushData = { type?: string; url?: string; ride_id?: string; trip_id?: string; ticket_id?: string };

/** Where a tapped notification should open (docs/spec/04-integration.md §10.2). */
export function pathForPush(data: PushData | null | undefined): string | null {
  if (!data) return null;
  const fromUrl = safeAppPath(data.url);
  if (fromUrl) return fromUrl;
  const type = data.type ?? '';
  if (type === 'ride.completed' && data.ride_id) return safeAppPath(`/complete/${data.ride_id}`);
  if (type.startsWith('ride.') && data.ride_id) return safeAppPath(`/ride/${data.ride_id}`);
  if (type === 'support.reply' && data.ticket_id) return safeAppPath(`/support/${data.ticket_id}`);
  if (type === 'safety.update') return '/safety';
  if (type === 'promo.offer') return '/home';
  return null;
}
