#!/usr/bin/env node
/**
 * Two guards on the shared contract:
 *
 *  1. Purity — nothing in contract/src may import app code, React, or a network
 *     client. The moment it does, the provider and admin apps can no longer
 *     consume it and the copies start again.
 *
 *  2. Drift — if the provider repo is present locally, compare its copies of the
 *     shared modules against ours. This is the check that would have caught the
 *     visit-fee vocabulary split (provider accepted 4 paid statuses, client 1),
 *     which let a customer be charged the same visit fee twice.
 *
 * Drift is reported, not fatal, until the provider migrates to the package.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const SRC = resolve('contract/src');
const PROVIDER = process.env.GHANDS_PROVIDER_PATH ?? resolve('..', 'ghands-provider');
const BANNED = [
  [/from\s+['"]@\//, "app-internal '@/…' import"],
  [/from\s+['"]react/, 'react import'],
  [/from\s+['"]react-native/, 'react-native import'],
  [/from\s+['"]expo/, 'expo import'],
  [/from\s+['"]\.\.\//, 'import from outside contract/src'],
  [/apiClient/, 'network client reference'],
];

let failed = false;
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'));

for (const file of files) {
  const body = readFileSync(join(SRC, file), 'utf8');
  for (const [pattern, label] of BANNED) {
    if (pattern.test(body)) {
      console.error(`✗ contract/src/${file}: ${label} — the contract must stay pure`);
      failed = true;
    }
  }
}
if (!failed) console.log(`✓ contract purity: ${files.length} modules, no app or platform imports`);

if (!existsSync(PROVIDER)) {
  console.log('· provider repo not found locally — skipping drift check');
} else {
  const norm = (s) => s.replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim();
  let drifted = 0;
  for (const file of files) {
    if (file === 'index.ts') continue;
    const theirs = join(PROVIDER, 'utils', basename(file));
    if (!existsSync(theirs)) {
      console.log(`· ${file}: absent in provider (not yet shared)`);
      continue;
    }
    if (norm(readFileSync(join(SRC, file), 'utf8')) !== norm(readFileSync(theirs, 'utf8'))) {
      console.warn(`⚠ ${file}: provider copy differs — reconcile before it costs a user money`);
      drifted++;
    } else {
      console.log(`✓ ${file}: identical to provider`);
    }
  }
  if (drifted) {
    console.warn(`\n${drifted} module(s) drifted. Migrate the provider to @ghands/contract to end this.`);
  }
}

process.exit(failed ? 1 : 0);
