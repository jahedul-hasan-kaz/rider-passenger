import { z } from 'zod';

import { buildUrl, createApiClient, type ApiClientDeps } from '../client';
import { ApiError } from '../errors';

type Call = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(responses: (Response | Error)[], overrides: Partial<ApiClientDeps> = {}) {
  const calls: Call[] = [];
  const queue = [...responses];
  const sleeps: number[] = [];
  let ids = 0;
  const deps: ApiClientDeps = {
    baseUrl: 'https://api.test/api/v1/',
    getAccessToken: async () => 'token-1',
    refreshSession: async () => 'token-2',
    getLanguage: () => 'bn',
    newId: () => `id-${++ids}`,
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0.5,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift();
      if (!next) throw new Error('unexpected extra call');
      if (next instanceof Error) throw next;
      return next;
    }) as unknown as typeof fetch,
    ...overrides,
  };
  return { client: createApiClient(deps), calls, sleeps };
}

const header = (call: Call, name: string) => (call.init.headers as Record<string, string>)[name];
const schema = z.object({ value: z.number() });

describe('api client', () => {
  it('unwraps the success envelope and sends auth, language and request id', async () => {
    const { client, calls } = setup([jsonResponse(200, { data: { value: 1 }, meta: { request_id: 'r', next_cursor: 'c2' } })]);
    const result = await client.request({ path: '/things', query: { limit: 20, cursor: undefined }, schema });

    expect(result.data).toEqual({ value: 1 });
    expect(result.meta.next_cursor).toBe('c2');
    expect(calls[0].url).toBe('https://api.test/api/v1/things?limit=20');
    expect(header(calls[0], 'Authorization')).toBe('Bearer token-1');
    expect(header(calls[0], 'Accept-Language')).toBe('bn');
    expect(header(calls[0], 'X-Request-Id')).toBe('id-1');
  });

  it('maps the error envelope to a typed ApiError with field errors', async () => {
    const { client } = setup([
      jsonResponse(400, {
        error: { code: 'VALIDATION_FAILED', message: 'Bad', details: { fields: [{ path: 'full_name', message: 'Too short' }] } },
        meta: { request_id: 'abc-def-123456' },
      }),
    ]);
    const error = await client.request({ path: '/me', schema }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('VALIDATION_FAILED');
    expect(apiError.status).toBe(400);
    expect(apiError.fieldErrors).toEqual([{ path: 'full_name', message: 'Too short' }]);
    expect(apiError.reference).toBe('ABCDEF12');
  });

  it('does not retry a business-rule error', async () => {
    const { client, calls } = setup([jsonResponse(409, { error: { code: 'ACTIVE_REQUEST_EXISTS' } })]);
    await expect(client.request({ path: '/rides', method: 'POST', body: {}, idempotencyKey: 'k', schema })).rejects.toMatchObject({
      code: 'ACTIVE_REQUEST_EXISTS',
    });
    expect(calls).toHaveLength(1);
  });

  it('retries a keyed mutation on network failure with the same idempotency key and request id', async () => {
    const { client, calls, sleeps } = setup([
      new TypeError('Network request failed'),
      jsonResponse(503, { error: { code: 'UPSTREAM_UNAVAILABLE' } }),
      jsonResponse(201, { data: { value: 7 } }, { 'Idempotent-Replayed': 'true' }),
    ]);
    const result = await client.request({ path: '/rides', method: 'POST', body: { quote_id: 'q' }, idempotencyKey: 'intent-key', schema });

    expect(result.data.value).toBe(7);
    expect(result.replayed).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => header(c, 'Idempotency-Key'))).toEqual(['intent-key', 'intent-key', 'intent-key']);
    expect(new Set(calls.map((c) => header(c, 'X-Request-Id'))).size).toBe(1);
    expect(calls[0].init.body).toBe(JSON.stringify({ quote_id: 'q' }));
    expect(sleeps).toEqual([400, 800]);
  });

  it('never retries a mutation that has no idempotency key', async () => {
    const { client, calls } = setup([new TypeError('Network request failed')]);
    await expect(client.request({ path: '/x', method: 'POST', body: {}, schema })).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
    expect(calls).toHaveLength(1);
  });

  it('retries an unkeyed call the server de-duplicates itself (SOS)', async () => {
    const { client, calls } = setup([new TypeError('Network request failed'), jsonResponse(200, { data: { value: 9 } })]);
    const result = await client.request({ path: '/trips/t/sos', method: 'POST', body: {}, retrySafe: true, schema });
    expect(result.data.value).toBe(9);
    expect(calls).toHaveLength(2);
    expect(header(calls[0], 'Idempotency-Key')).toBeUndefined();
  });

  it('gives up after the attempt budget for reads', async () => {
    const { client, calls } = setup([jsonResponse(500, undefined), jsonResponse(500, undefined), jsonResponse(500, undefined)]);
    await expect(client.request({ path: '/me', schema })).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
    expect(calls).toHaveLength(3);
  });

  it('keeps asking with the same key while the original request is still processing', async () => {
    const { client, calls } = setup([
      jsonResponse(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' } }),
      jsonResponse(200, { data: { value: 2 } }),
    ]);
    const result = await client.request({ path: '/rides', method: 'POST', body: {}, idempotencyKey: 'k', schema });
    expect(result.data.value).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('refreshes the session once on 401 and replays with the new token', async () => {
    const { client, calls } = setup([jsonResponse(401, { error: { code: 'SESSION_EXPIRED' } }), jsonResponse(200, { data: { value: 3 } })]);
    const result = await client.request({ path: '/me', schema });

    expect(result.data.value).toBe(3);
    expect(header(calls[1], 'Authorization')).toBe('Bearer token-2');
  });

  it('reports a lost session when the refresh fails', async () => {
    const onSessionLost = jest.fn();
    const { client, calls } = setup([jsonResponse(401, { error: { code: 'UNAUTHENTICATED' } })], {
      refreshSession: async () => null,
      onSessionLost,
    });
    await expect(client.request({ path: '/me', schema })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it('surfaces Retry-After on 429 without hammering the server', async () => {
    const { client, calls } = setup([jsonResponse(429, { error: { code: 'RATE_LIMITED' } }, { 'Retry-After': '12' })]);
    await expect(client.request({ path: '/quotes', method: 'POST', body: {}, idempotencyKey: 'k', schema })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterS: 12,
    });
    expect(calls).toHaveLength(1);
  });

  it('flags a response that breaks the contract and does not retry it', async () => {
    const onContractError = jest.fn();
    const { client, calls } = setup([jsonResponse(200, { data: { value: 'not a number' } })], { onContractError });
    await expect(client.request({ path: '/me', schema })).rejects.toMatchObject({ code: 'CONTRACT' });
    expect(onContractError).toHaveBeenCalledWith(expect.objectContaining({ path: '/me', issues: [expect.stringContaining('value')] }));
    expect(calls).toHaveLength(1);
  });

  it('derives a code when an error has no envelope', async () => {
    const { client } = setup([new Response('<html>Bad gateway</html>', { status: 404 })]);
    await expect(client.request({ path: '/nope', schema })).rejects.toMatchObject({ code: 'CONTRACT', status: 404 });
  });

  it('omits the bearer token for public calls', async () => {
    const { client, calls } = setup([jsonResponse(200, { data: { value: 1 } })]);
    await client.request({ path: '/health', schema, auth: false });
    expect(header(calls[0], 'Authorization')).toBeUndefined();
  });
});

describe('buildUrl', () => {
  it('encodes query values and skips empty ones', () => {
    expect(buildUrl('https://a.test/api/v1', 'zones/check', { lat: 23.79, lng: 90.4, q: 'Road 11 & 12', x: null })).toBe(
      'https://a.test/api/v1/zones/check?lat=23.79&lng=90.4&q=Road%2011%20%26%2012',
    );
  });
});
