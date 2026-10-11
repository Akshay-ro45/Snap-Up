#!/usr/bin/env node
/**
 * Creates a Neon snapshot of the production branch.
 *
 * Exists because the Neon plan in use does not offer scheduled snapshots and caps
 * point-in-time recovery at six hours. The backup workflow calls this daily; the migration
 * workflow calls it immediately before applying any schema change.
 */
const API_KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const BRANCH = process.env.NEON_BRANCH_ID;
const name = process.argv[2] ?? `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`;

if (!API_KEY || !PROJECT || !BRANCH) {
  console.error('NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID are required.');
  process.exit(1);
}

const response = await fetch(
  `https://console.neon.tech/api/v2/projects/${PROJECT}/branches/${BRANCH}/snapshot`,
  {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  }
);

if (!response.ok) {
  // The body can echo request context, so only the status and a short excerpt are shown.
  const detail = (await response.text()).slice(0, 200);
  console.error(`Snapshot failed (${response.status}): ${detail}`);
  process.exit(1);
}

const body = await response.json();
console.log(`snapshot created: ${body?.snapshot?.id ?? name}`);
