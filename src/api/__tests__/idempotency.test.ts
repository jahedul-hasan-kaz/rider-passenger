import { ApiError } from '../errors';
import { createIntents } from '../idempotency';

function intents() {
  let n = 0;
  return createIntents(() => `key-${++n}`);
}

const transient = new ApiError({ code: 'NETWORK', status: 0, requestId: 'r' });
const final = new ApiError({ code: 'QUOTE_EXPIRED', status: 409, requestId: 'r' });

describe('intents', () => {
  it('reuses the key for every retry of the same intent until it succeeds', async () => {
    const keys = intents();
    const seen: string[] = [];
    await expect(keys.run('ride.request', async (key) => (seen.push(key), Promise.reject(transient)))).rejects.toBe(transient);
    await keys.run('ride.request', async (key) => void seen.push(key));
    await keys.run('ride.request', async (key) => void seen.push(key));
    expect(seen).toEqual(['key-1', 'key-1', 'key-2']);
  });

  it('settles on a final error so the next deliberate attempt gets a new key', async () => {
    const keys = intents();
    const seen: string[] = [];
    await expect(keys.run('ride.request', async (key) => (seen.push(key), Promise.reject(final)))).rejects.toBe(final);
    await keys.run('ride.request', async (key) => void seen.push(key));
    expect(seen).toEqual(['key-1', 'key-2']);
  });

  it('keeps separate keys per intent', () => {
    const keys = intents();
    expect(keys.keyFor('cancel:ride-1')).not.toBe(keys.keyFor('cancel:ride-2'));
    expect(keys.keyFor('cancel:ride-1')).toBe('key-1');
  });
});
