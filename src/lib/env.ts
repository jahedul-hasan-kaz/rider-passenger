import { z } from 'zod';

// Public runtime configuration (docs/spec/01-overview-foundation.md §4).
// Expo inlines `process.env.EXPO_PUBLIC_*` only when each variable is referenced literally, so every read below is
// spelled out in full. Nothing secret may ever be added here: these values ship inside the app bundle.

const url = z.url({ protocol: /^https?$/ });

export const publicEnvSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']),
  EXPO_PUBLIC_API_BASE_URL: url.transform((value) => value.replace(/\/+$/, '')),
  EXPO_PUBLIC_SUPABASE_URL: url,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  EXPO_PUBLIC_MAP_STYLE_URL: url,
  EXPO_PUBLIC_SENTRY_DSN: z.union([url, z.literal('')]).default(''),
  /** Offers sign-in by SMS code. Off until an SMS gateway is set up in Supabase; email codes always work. */
  EXPO_PUBLIC_PHONE_SIGN_IN: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** Shows "Continue with Google" once the Google provider is configured in Supabase (decision D3). */
  EXPO_PUBLIC_GOOGLE_SIGN_IN: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** Public URLs of the legal pages (opened in an in-app browser). */
  EXPO_PUBLIC_TERMS_URL: z.union([url, z.literal('')]).default(''),
  EXPO_PUBLIC_PRIVACY_URL: z.union([url, z.literal('')]).default(''),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

const FORBIDDEN_NAME = /SECRET|SERVICE|PRIVATE|TOKEN/;

/** Validates raw values; throws one readable error listing every problem. */
export function parsePublicEnv(raw: Record<string, string | undefined>): PublicEnv {
  const leaked = Object.keys(raw).filter((name) => name.startsWith('EXPO_PUBLIC_') && FORBIDDEN_NAME.test(name));
  if (leaked.length > 0) {
    throw new Error(`Public env names must not look secret: ${leaked.join(', ')}`);
  }
  const result = publicEnvSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid app configuration — ${problems}. See .env.example.`);
  }
  if (result.data.EXPO_PUBLIC_APP_ENV === 'production' && !result.data.EXPO_PUBLIC_API_BASE_URL.startsWith('https://')) {
    throw new Error('Production builds must call the API over https.');
  }
  return result.data;
}

let cached: PublicEnv | undefined;

export function env(): PublicEnv {
  cached ??= parsePublicEnv({
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_PHONE_SIGN_IN: process.env.EXPO_PUBLIC_PHONE_SIGN_IN,
    EXPO_PUBLIC_GOOGLE_SIGN_IN: process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN,
    EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
    EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  });
  return cached;
}
