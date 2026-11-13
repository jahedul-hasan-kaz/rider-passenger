import * as Sentry from '@sentry/react-native';

import type { ContractFailure } from '@/api/client';
import { isApiError } from '@/api/errors';

import { env } from './env';
import { scrubBreadcrumb, scrubEvent } from './scrub';

// Crash and error reporting (docs/spec/01-overview-foundation.md §3). Every event and breadcrumb is scrubbed of
// personal data before it leaves the device; requests are correlated with the backend through X-Request-Id.

let started = false;

export function initMonitoring(): void {
  if (started) return;
  started = true;
  const { EXPO_PUBLIC_SENTRY_DSN: dsn, EXPO_PUBLIC_APP_ENV: environment } = env();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: environment === 'production' ? 0.1 : 1,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}

export function setMonitoringUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Reports an unexpected error. Expected API outcomes (validation, 4xx business rules) are not sent. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (isApiError(error)) {
    const unexpected = error.code === 'CONTRACT' || error.status >= 500;
    if (!unexpected) return;
    Sentry.captureException(error, { tags: { api_code: String(error.code) }, extra: { ...context, request_id: error.requestId } });
    return;
  }
  Sentry.captureException(error, { extra: context });
}

/** The server answered with a shape the app does not understand: the contract drifted (gap B15). */
export function reportContractFailure(failure: ContractFailure): void {
  Sentry.captureMessage(`API contract mismatch: ${failure.method} ${failure.path}`, {
    level: 'error',
    tags: { api_path: failure.path, api_status: String(failure.status) },
    extra: { request_id: failure.requestId, issues: failure.issues.slice(0, 20) },
  });
}

export const wrapRoot = Sentry.wrap;
