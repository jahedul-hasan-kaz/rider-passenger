#!/usr/bin/env node
// Every string must exist in English and Bengali (docs/spec/05-quality-delivery.md §12.4), with the same
// interpolation variables, and no value may be empty.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = ['en', 'bn'];
const load = (locale) => JSON.parse(readFileSync(new URL(`../src/i18n/${locale}.json`, import.meta.url), 'utf8'));

function flatten(object, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, path, out);
    else out[path] = String(value);
  }
  return out;
}

const vars = (text) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort().join(',');
const tables = Object.fromEntries(LOCALES.map((locale) => [locale, flatten(load(locale))]));
const reference = tables.en;
const problems = [];

for (const locale of LOCALES) {
  const table = tables[locale];
  for (const key of Object.keys(reference)) {
    if (!(key in table)) problems.push(`${locale}: missing ${key}`);
    else if (vars(table[key]) !== vars(reference[key])) problems.push(`${locale}: ${key} has variables {${vars(table[key])}}, expected {${vars(reference[key])}}`);
  }
  for (const [key, value] of Object.entries(table)) {
    if (!(key in reference)) problems.push(`${locale}: extra key ${key} (not in en)`);
    if (value.trim() === '') problems.push(`${locale}: empty ${key}`);
  }
}

// Every literal key used in the app (`t('a.b')`, `i18n.t('a.b')`) must exist. Template keys are checked by tests.
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__') sources(path, out);
    } else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
const srcDir = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
for (const file of sources(srcDir)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:^|[^A-Za-z0-9_.])t\(\s*'([A-Za-z0-9_.]+)'/g)) {
    const key = match[1];
    if (!(key in reference) && !(`${key}_one` in reference)) problems.push(`code: ${key} is used in ${file.slice(srcDir.length + 1)} but missing from en.json`);
  }
}

if (problems.length > 0) {
  console.error('i18n check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`i18n check passed (${Object.keys(reference).length} keys × ${LOCALES.length} languages).`);
