#!/usr/bin/env node
/**
 * Nothing may end a session from a locally computed token expiry.
 *
 * This came back three times. isAccessTokenExpired was dead code for the life
 * of the app, because React Native has no atob and the decoder gave up without
 * one. Fixing the decoder switched on four separate logout paths at once: a
 * pathname guard, a two-second poll, the launch router, and the request
 * interceptor, which runs on every call and so signed people out mid-screen.
 *
 * Each was found only when a person hit it. This finds the next one.
 *
 * The rule: our clock is not the server's. A device with the wrong date, a
 * token the server still honours, or a grace period we know nothing about all
 * end with somebody thrown out of a session that works. Only a 401 ends a
 * session.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve('.');
const SKIP = new Set(['node_modules', '.git', '.expo', 'dist', 'ios', 'android', '__tests__']);
const ALLOWED = new Set(['utils/jwtExpiry.ts', 'contract/src/jwtExpiry.ts']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (ALLOWED.has(rel)) continue;
  const body = readFileSync(file, 'utf8');
  if (!body.includes('isAccessTokenExpired')) continue;
  body.split('\n').forEach((line, i) => {
    if (line.includes('isAccessTokenExpired') && !line.trim().startsWith('*')) {
      offenders.push(`${rel}:${i + 1}`);
    }
  });
}

if (offenders.length > 0) {
  console.error('✗ a locally computed expiry must not decide a session is over:\n');
  offenders.forEach((o) => console.error(`  ${o}`));
  console.error('\nOnly a 401 from the server ends a session. If this use is genuinely');
  console.error('something else, add the file to ALLOWED in scripts/check-session-ends.mjs');
  console.error('with a comment saying why.\n');
  process.exit(1);
}

console.log('✓ no local token expiry decides a session');
