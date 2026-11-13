import type { z } from 'zod';

import { ApiError, isTransient } from './errors';
import { errorBodySchema, successEnvelope, type ResponseMeta } from './schemas';

// Typed client for rider-admin's `/api/v1` (docs/spec/04-integration.md §8.1):
// envelope unwrap, typed errors, bearer auth with one refresh on 401, request ids, idempotency keys reused across
// retries, timeouts, jittered backoff for transient failures, and Zod-checked responses so contract drift is caught
// in monitoring instead of by users. Every dependency is injected so the client is testable without a device.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export type ApiRequest<S extends z.ZodType> = {
  method?: HttpMethod;
  /** Path below the API base, e.g. `/rides/123`. */
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Schema for `data` in the success envelope. */
  schema: S;
  /**
   * One key per user intent (see `idempotency.ts`). Required by the server on every state-changing POST it marks
   * idempotent; mutations are retried automatically only when a key is present.
   */
  idempotencyKey?: string;
  /** The server de-duplicates this call itself (SOS), so it may be retried without an idempotency key. */
  retrySafe?: boolean;
  /** Send the bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
  /** Total attempts for transient failures (default 3 for GETs and keyed mutations, 1 otherwise). */
  maxAttempts?: number;
  signal?: AbortSignal;
};

export type ApiResponse<T> = {
  data: T;
  meta: ResponseMeta;
  requestId: string;
  /** The server answered from its idempotency store: the original call had already succeeded. */
  replayed: boolean;
};

export type ContractFailure = { method: HttpMethod; path: string; status: number; requestId: string; issues: string[] };

export type ApiClientDeps = {
  baseUrl: string;
  /** Current access token, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  /** Refreshes the session once; resolves to the new access token, or null if the session cannot be recovered. */
  refreshSession: () => Promise<string | null>;
  /** Called when a 401 survives a refresh: the app should sign the user out. */
  onSessionLost?: () => void;
  /** BCP-47 language sent as `Accept-Language` so server messages come back localised. */
  getLanguage?: () => string;
  onContractError?: (failure: ContractFailure) => void;
  fetch?: typeof fetch;
  newId?: () => string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export const DEFAULT_TIMEOUT_MS = { read: 10_000, write: 15_000 } as const;
const MAX_BACKOFF_MS = 4_000;

export type ApiClient = {
  request<S extends z.ZodType>(request: ApiRequest<S>): Promise<ApiResponse<z.output<S>>>;
};

export function createApiClient(deps: ApiClientDeps): ApiClient {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = deps.random ?? Math.random;
  const newId = deps.newId ?? (() => globalThis.crypto.randomUUID());
  const baseUrl = deps.baseUrl.replace(/\/+$/, '');

  async function request<S extends z.ZodType>(req: ApiRequest<S>): Promise<ApiResponse<z.output<S>>> {
    const method = req.method ?? 'GET';
    const isRead = method === 'GET';
    const canRetry = isRead || req.idempotencyKey !== undefined || req.retrySafe === true;
    const maxAttempts = Math.max(1, req.maxAttempts ?? (canRetry ? 3 : 1));
    const requestId = newId();
    const useAuth = req.auth ?? true;
    let refreshed = false;
    let token = useAuth ? await deps.getAccessToken() : null;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await attemptOnce(req, method, requestId, token);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;

        // Expired token: refresh once per call and replay immediately; this does not use up an attempt.
        if (useAuth && error.status === 401 && !refreshed) {
          refreshed = true;
          token = await deps.refreshSession().catch(() => null);
          if (token) {
            attempt -= 1;
            continue;
          }
          deps.onSessionLost?.();
          throw error;
        }
        if (useAuth && error.status === 401) deps.onSessionLost?.();

        // A keyed duplicate that is still being processed resolves itself; wait and ask again with the same key.
        const stillProcessing = error.code === 'IDEMPOTENCY_KEY_REUSED' && req.idempotencyKey !== undefined;
        const retryable = canRetry && (isTransient(error) || stillProcessing);
        if (!retryable || attempt >= maxAttempts || req.signal?.aborted) throw error;

        const backoff = Math.min(MAX_BACKOFF_MS, 400 * 2 ** (attempt - 1));
        await sleep(Math.round(backoff * (0.5 + random())));
      }
    }
  }

  async function attemptOnce<S extends z.ZodType>(
    req: ApiRequest<S>,
    method: HttpMethod,
    requestId: string,
    token: string | null,
  ): Promise<ApiResponse<z.output<S>>> {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-Id': requestId };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (req.idempotencyKey) headers['Idempotency-Key'] = req.idempotencyKey;
    const language = deps.getLanguage?.();
    if (language) headers['Accept-Language'] = language;
    let body: string | undefined;
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }

    const timeoutMs = req.timeoutMs ?? (method === 'GET' ? DEFAULT_TIMEOUT_MS.read : DEFAULT_TIMEOUT_MS.write);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    req.signal?.addEventListener('abort', onCallerAbort);

    let response: Response;
    let text: string;
    try {
      if (req.signal?.aborted) controller.abort();
      response = await doFetch(buildUrl(baseUrl, req.path, req.query), { method, headers, body, signal: controller.signal });
      text = await response.text();
    } catch (cause) {
      const code = timedOut ? 'TIMEOUT' : req.signal?.aborted ? 'ABORTED' : 'NETWORK';
      throw new ApiError({ code, status: 0, requestId, cause });
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', onCallerAbort);
    }

    const json = parseJson(text);
    const serverRequestId = response.headers.get('X-Request-Id') ?? requestId;

    if (!response.ok) throw toApiError(response, json, serverRequestId);

    const parsed = successEnvelope(req.schema).safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      deps.onContractError?.({ method, path: req.path, status: response.status, requestId: serverRequestId, issues });
      throw new ApiError({ code: 'CONTRACT', status: response.status, requestId: serverRequestId, details: { issues } });
    }
    const envelope = parsed.data as { data: z.output<S>; meta?: ResponseMeta };
    return {
      data: envelope.data,
      meta: envelope.meta ?? {},
      requestId: serverRequestId,
      replayed: response.headers.get('Idempotent-Replayed') === 'true',
    };
  }

  return { request };
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${baseUrl}${normalisedPath}${params.length > 0 ? `?${params.join('&')}` : ''}`;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, json: unknown, requestId: string): ApiError {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterS = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined;
  const body = errorBodySchema.safeParse(json);
  if (body.success) {
    return new ApiError({
      code: body.data.error.code,
      status: response.status,
      message: body.data.error.message,
      details: body.data.error.details,
      requestId: body.data.meta?.request_id ?? requestId,
      retryAfterS,
    });
  }
  // No envelope (proxy, gateway or crash page): derive the code from the status.
  const code =
    response.status === 401 ? 'UNAUTHENTICATED' : response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'INTERNAL' : 'CONTRACT';
  return new ApiError({ code, status: response.status, requestId, retryAfterS });
}
