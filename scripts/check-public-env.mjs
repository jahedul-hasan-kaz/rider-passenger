#!/usr/bin/env node
// CI guard (docs/spec/01-overview-foundation.md §4): nothing secret may ship in the app bundle.
//  1. No EXPO_PUBLIC_* name may contain SECRET, SERVICE, PRIVATE or TOKEN — in env files, eas.json or source.
//  2. App source may read only EXPO_PUBLIC_* variables (anything else is undefined at runtime, or a leak).
//  3. No literal that looks like a Supabase secret / service-role key may appear in tracked app files.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const FORBIDDEN = /EXPO_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE|PRIVATE|TOKEN)[A-Z0-9_]*/g;
const NON_PUBLIC_READ = /process\.env\.(?!EXPO_PUBLIC_)([A-Z0-9_]+)/g;
const SECRET_LITERAL = /sb_secret_[A-Za-z0-9_-]{10,}|"role"\s*:\s*"service_role"/g;
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'android', 'ios', 'dist', 'coverage', 'docs']);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/;

/** Files that run at build time on the developer machine or CI, where non-public env reads are expected. */
const BUILD_TIME = new Set(['app.config.ts', 'scripts/check-public-env.mjs', 'scripts/check-i18n.mjs', 'jest.setup.ts']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const problems = [];
for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const isEnvFile = /^\.env(\..+)?$/.test(rel.split('/').pop());
  if (!isEnvFile && !SOURCE_EXT.test(rel)) continue;
  const text = readFileSync(file, 'utf8');

  for (const match of text.matchAll(FORBIDDEN)) problems.push(`${rel}: secret-looking public name ${match[0]}`);
  for (const match of text.matchAll(SECRET_LITERAL)) problems.push(`${rel}: looks like a secret key (${match[0].slice(0, 14)}…)`);
  if (rel.startsWith('src/') && !BUILD_TIME.has(rel)) {
    for (const match of text.matchAll(NON_PUBLIC_READ)) {
      if (match[1] === 'NODE_ENV') continue;
      problems.push(`${rel}: app code reads non-public env ${match[1]}`);
    }
  }
}

if (problems.length > 0) {
  console.error('Public env check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Public env check passed.');
