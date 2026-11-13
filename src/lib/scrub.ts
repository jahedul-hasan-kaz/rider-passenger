// Removes personal data before anything leaves the device for monitoring (docs/spec/05-quality-delivery.md §12.2):
// phone numbers, emails, tokens, coordinates, addresses, PINs. Pure functions so they can be tested without Sentry.

export const REDACTED = '[redacted]';

const SENSITIVE_KEY =
  /phone|email|token|authorization|password|secret|cookie|session|pin|otp|code_verifier|^lat$|^lng$|latitude|longitude|location|address|label|note|full_name|^name$|idempotency/i;

const PHONE = /(?:\+?88)?01[3-9]\d{8}/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function scrubString(value: string): string {
  return value.replace(BEARER, `Bearer ${REDACTED}`).replace(JWT, REDACTED).replace(EMAIL, REDACTED).replace(PHONE, REDACTED);
}

/** Drops the query string: it may carry coordinates (`/zones/check?lat=…`) or cursors. */
export function scrubUrl(url: string): string {
  const index = url.indexOf('?');
  return scrubString(index === -1 ? url : `${url.slice(0, index)}?${REDACTED}`);
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : key === 'url' && typeof inner === 'string' ? scrubUrl(inner) : scrubValue(inner, depth + 1);
    }
    return out;
  }
  return value;
}

type ScrubbableEvent = {
  message?: string;
  user?: Record<string, unknown>;
  request?: { url?: string; headers?: Record<string, string>; data?: unknown; query_string?: unknown; cookies?: unknown };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
};

/** Scrubs a Sentry event in place-compatible shape; keeps only the user id. */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out = { ...event };
  if (out.message) out.message = scrubString(out.message);
  if (out.user) out.user = typeof out.user.id === 'string' ? { id: out.user.id } : {};
  if (out.request) {
    out.request = {
      ...out.request,
      url: out.request.url ? scrubUrl(out.request.url) : undefined,
      headers: undefined,
      cookies: undefined,
      query_string: undefined,
      data: out.request.data === undefined ? undefined : REDACTED,
    };
  }
  if (out.extra) out.extra = scrubValue(out.extra) as Record<string, unknown>;
  if (out.contexts) out.contexts = scrubValue(out.contexts) as Record<string, unknown>;
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  if (out.exception?.values) {
    out.exception = { ...out.exception, values: out.exception.values.map((v) => ({ ...v, value: v.value ? scrubString(v.value) : v.value })) };
  }
  return out;
}

export function scrubBreadcrumb<B extends { message?: string; data?: Record<string, unknown> }>(breadcrumb: B): B {
  return {
    ...breadcrumb,
    message: breadcrumb.message ? scrubString(breadcrumb.message) : breadcrumb.message,
    data: breadcrumb.data ? (scrubValue(breadcrumb.data) as Record<string, unknown>) : breadcrumb.data,
  };
}
