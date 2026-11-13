#!/usr/bin/env node
// Runs a command against the LOCAL backend without touching .env files:
//   node scripts/with-local-backend.mjs npx expo start --web
// Reads the local Supabase stack's URL and publishable key from the Supabase CLI in ../rider-admin, and points the API
// at the local rider-admin (start it with `pnpm with-local next dev -p 3005` there). Process environment takes
// precedence over .env files in the Expo CLI. Refuses anything that is not the local stack.
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/with-local-backend.mjs <command> [...args]');
  process.exit(1);
}

const adminDir = resolve(process.env.RIDER_ADMIN_DIR ?? '../rider-admin');
const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { cwd: adminDir, encoding: 'utf8', shell: true }));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) {
  console.error('Refusing: the Supabase CLI is not pointing at a local stack.');
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EXPO_PUBLIC_APP_ENV: 'development',
    EXPO_PUBLIC_API_BASE_URL: process.env.LOCAL_API_BASE_URL ?? 'http://localhost:3005/api/v1',
    EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
