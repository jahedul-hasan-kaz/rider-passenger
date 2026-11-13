// Error model for the mobile REST API (rider-admin docs/spec/05-api.md §1, src/server/http/errors.ts).
// Server codes are passed through unchanged; the client adds four of its own for failures that never reached
// (or could not be understood from) the server.

export const SERVER_ERROR_CODES = [
  'VALIDATION_FAILED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'ACCOUNT_SUSPENDED',
  'ROLE_NOT_ALLOWED',
  'DRIVER_NOT_APPROVED',
  'NOT_FOUND',
  'INVALID_STATE_TRANSITION',
  'OFFER_NO_LONGER_AVAILABLE',
  'ACTIVE_REQUEST_EXISTS',
  'STALE_VERSION',
  'IDEMPOTENCY_KEY_REUSED',
  'QUOTE_EXPIRED',
  'ALREADY_EXISTS',
  'OUT_OF_SERVICE_AREA',
  'PRICING_UNAVAILABLE',
  'PROMO_INVALID',
  'LOCATION_STALE',
  'TOO_FAR_FROM_PICKUP',
  'RATE_LIMITED',
  'INTERNAL',
  'UPSTREAM_UNAVAILABLE',
] as const;

/** Client-side codes: no response (NETWORK), no response in time (TIMEOUT), cancelled by the caller (ABORTED),
 *  or a response that does not match the agreed contract (CONTRACT). */
export const CLIENT_ERROR_CODES = ['NETWORK', 'TIMEOUT', 'ABORTED', 'CONTRACT'] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
/** Unknown server codes are kept as strings so a newer backend never crashes an older app. */
export type ApiErrorCode = ServerErrorCode | ClientErrorCode | (string & {});

export type FieldError = { path: string; message: string };

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** HTTP status, or 0 when no response was received. */
  readonly status: number;
  readonly details: Record<string, unknown>;
  readonly requestId: string;
  /** Seconds to wait before trying again (429 `Retry-After`). */
  readonly retryAfterS?: number;

  constructor(init: {
    code: ApiErrorCode;
    status: number;
    message?: string;
    details?: Record<string, unknown>;
    requestId: string;
    retryAfterS?: number;
    cause?: unknown;
  }) {
    super(init.message ?? init.code, { cause: init.cause });
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details ?? {};
    this.requestId = init.requestId;
    this.retryAfterS = init.retryAfterS;
  }

  /** Short reference shown on error screens so support can find the request in the server logs. */
  get reference(): string {
    return this.requestId.replaceAll('-', '').slice(0, 8).toUpperCase();
  }

  /** Field-level messages from `VALIDATION_FAILED`. */
  get fieldErrors(): FieldError[] {
    const fields = this.details.fields;
    if (!Array.isArray(fields)) return [];
    return fields.filter(
      (f): f is FieldError => typeof f === 'object' && f !== null && typeof f.path === 'string' && typeof f.message === 'string',
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isApiErrorCode(error: unknown, ...codes: ApiErrorCode[]): error is ApiError {
  return isApiError(error) && codes.includes(error.code);
}

/** Failures worth retrying automatically: the request may never have been processed, or the server was briefly unwell. */
export function isTransient(error: ApiError): boolean {
  return error.code === 'NETWORK' || error.code === 'TIMEOUT' || error.status >= 500;
}

/** The session is gone and cannot be refreshed: the user has to sign in again. */
export function isAuthFailure(error: unknown): boolean {
  return isApiErrorCode(error, 'UNAUTHENTICATED', 'SESSION_EXPIRED');
}
