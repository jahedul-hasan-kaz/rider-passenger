import { parsePublicEnv } from '../env';

const valid = {
  EXPO_PUBLIC_APP_ENV: 'staging',
  EXPO_PUBLIC_API_BASE_URL: 'https://staging.example.com/api/v1/',
  EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnop',
  EXPO_PUBLIC_MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
  EXPO_PUBLIC_SENTRY_DSN: '',
};

describe('parsePublicEnv', () => {
  it('accepts a complete configuration and trims the API base trailing slash', () => {
    expect(parsePublicEnv(valid).EXPO_PUBLIC_API_BASE_URL).toBe('https://staging.example.com/api/v1');
  });

  it('lists every missing or invalid value at once', () => {
    expect(() => parsePublicEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: undefined, EXPO_PUBLIC_APP_ENV: 'prod' })).toThrow(
      /EXPO_PUBLIC_APP_ENV.*EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_URL.*EXPO_PUBLIC_APP_ENV/,
    );
  });

  it('refuses public names that look like secrets', () => {
    const leaked = 'EXPO_PUBLIC_SUPABASE_' + 'SERVICE_ROLE';
    expect(() => parsePublicEnv({ ...valid, [leaked]: 'x' })).toThrow(/must not look secret/);
  });

  it('requires https in production', () => {
    expect(() => parsePublicEnv({ ...valid, EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000/api/v1' })).toThrow(
      /https/,
    );
  });
});
