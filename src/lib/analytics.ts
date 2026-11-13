import * as Sentry from '@sentry/react-native';

// Funnel events (docs/spec/05-quality-delivery.md §12.5). No personal data ever: no names, phone numbers, addresses,
// coordinates or free text — only the event name and a few enum-like or numeric properties, enforced by the types
// and by `clean` below. They feed the blueprint KPIs (request-to-match, time to match, cancellation, fare-estimate
// variance, repeat rate).
//
// Destination: Sentry breadcrumbs for now, so every error report carries the steps that led to it. A product
// analytics provider plugs in at `deliver` once one is chosen.

export type AnalyticsEvent =
  | 'onboarding_step_completed'
  | 'location_permission_result'
  | 'category_selected'
  | 'destination_selected'
  | 'quote_shown'
  | 'quote_changed'
  | 'ride_requested'
  | 'match_time'
  | 'ride_cancelled'
  | 'no_driver_found'
  | 'trip_completed'
  | 'rating_submitted'
  | 'sos_triggered'
  | 'push_permission_result';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

// Must start with a letter, so a bare phone number (`01712345678`) can never pass as a "code".
const SAFE_STRING = /^[a-z][a-z0-9_.-]{0,39}$/i;

/** Keeps numbers and booleans, and only short code-like strings (`bike`, `searching`, `quick_home`). */
export function clean(props: AnalyticsProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.round(value * 100) / 100;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string' && SAFE_STRING.test(value)) out[key] = value;
  }
  return out;
}

type Sink = (event: AnalyticsEvent, props: Record<string, string | number | boolean>) => void;

let deliver: Sink = (event, props) => {
  Sentry.addBreadcrumb({ category: 'analytics', message: event, data: props, level: 'info' });
};

/** Swap the destination (tests, or a product analytics SDK later). */
export function setAnalyticsSink(sink: Sink): void {
  deliver = sink;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  try {
    deliver(event, clean(props));
  } catch {
    // Analytics must never break the app.
  }
}
