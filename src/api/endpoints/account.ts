import { z } from 'zod';

import type { ApiClient } from '../client';

// Account and start-up endpoints (docs/spec/04-integration.md §8.2, §8.4). Shapes follow rider-admin as built:
// api.get_my_profile and api.client_config.

export const ROLES = ['user', 'passenger', 'driver', 'admin'] as const;
export const ACCOUNT_STATUSES = ['active', 'suspended', 'deactivated'] as const;

export const meSchema = z.object({
  id: z.uuid(),
  role: z.enum(ROLES),
  status: z.enum(ACCOUNT_STATUSES),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  preferred_language: z.string(),
  version: z.number().int(),
});
export type Me = z.infer<typeof meSchema>;

// Settings come out of a jsonb store, so numbers may arrive as numbers or numeric strings.
const seconds = z.coerce.number().int().nonnegative();

export const clientConfigSchema = z.object({
  flags: z.record(z.string(), z.boolean()).default({}),
  settings: z
    .object({
      cancellation_free_window_s: seconds.catch(120),
      quote_ttl_s: seconds.catch(300),
      payment_methods: z.array(z.string()).catch(['cash']),
      rating_window_days: seconds.catch(7),
    })
    .partial()
    .default({}),
});
export type ClientConfig = z.infer<typeof clientConfigSchema>;

/** Feature flags the passenger app reads (rider-admin `feature_flags`). Unknown flags are ignored. */
export type FeatureFlag = 'pickup_pin' | 'promo_codes' | 'digital_payments' | 'auto_surge';

export function isFlagOn(config: ClientConfig | undefined, flag: FeatureFlag): boolean {
  return config?.flags[flag] === true;
}

export async function getMe(api: ApiClient): Promise<Me> {
  return (await api.request({ path: '/me', schema: meSchema })).data;
}

export async function getClientConfig(api: ApiClient): Promise<ClientConfig> {
  return (await api.request({ path: '/config', schema: clientConfigSchema })).data;
}
