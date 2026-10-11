#!/usr/bin/env node
/**
 * Fails the build if anything secret-shaped reaches the browser.
 *
 * Next.js only exposes NEXT_PUBLIC_* variables to the client, which is a rule enforced by
 * the framework — but a value can still reach a bundle by being hard-coded, by being
 * passed as a prop from a server component, or by a NEXT_PUBLIC_ variable being given a
 * value that should never have been public. This checks the built output rather than the
 * source, because the built output is what the browser actually receives.
 */
import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';

const BUNDLES = ['apps/customer-web/.next/static', 'apps/admin-web/.next/static'];

// Provider key formats and credential shapes. Deliberately specific: a broad entropy
// heuristic on minified JavaScript is all false positives.
const PATTERNS = [
  [/cfsk_ma_(prod|test)_[A-Za-z0-9]{8,}/, 'Cashfree secret key'],
  [/rzp_(live|test)_[A-Za-z0-9]{8,}/, 'Razorpay key'],
  [/sk_(live|test)_[A-Za-z0-9]{12,}/, 'Stripe-style secret key'],
  [/GOCSPX-[A-Za-z0-9_-]{20,}/, 'Google OAuth client secret'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/postgres(ql)?:\/\/[^:/\s"']+:[^@/\s"']{6,}@/, 'database connection string'],
  [/\b(SNAPUP_[A-Z_]+|DATABASE_URL|GOOGLE_CLIENT_SECRET|UPSTASH_REDIS_REST_TOKEN)\s*[:=]\s*["'][A-Za-z0-9_+/=:@.-]{16,}["']/, 'server-side variable with a value'],
];

let checked = 0;
const offences = [];

for (const dir of BUNDLES) {
  if (!existsSync(dir)) {
    console.error(`${dir} is missing — build before running this check.`);
    process.exit(1);
  }
  for (const file of globSync(`${dir}/**/*.{js,json,css,map}`, { cwd: process.cwd() })) {
    checked += 1;
    const source = readFileSync(file, 'utf8');
    for (const [pattern, label] of PATTERNS) {
      if (pattern.test(source)) offences.push(`${file}: ${label}`);
    }
  }
  // Source maps expose original server-adjacent code to anyone who opens devtools.
  const maps = globSync(`${dir}/**/*.map`, { cwd: process.cwd() });
  if (maps.length > 0) offences.push(`${dir}: ${maps.length} source map(s) shipped to the browser`);
}

if (offences.length > 0) {
  console.error('Secret-shaped content in the client bundle:\n');
  for (const o of offences) console.error('  ' + o);
  process.exit(1);
}
console.log(`Bundle safety: ${checked} client files checked, nothing secret-shaped, no source maps`);
