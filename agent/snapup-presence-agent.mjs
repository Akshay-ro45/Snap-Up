#!/usr/bin/env node
/**
 * SnapUp Store Presence Agent.
 *
 * Runs on an always-on machine inside the shop and does one thing: tell SnapUp, every
 * thirty seconds, that this network is up. SnapUp records the address the heartbeat
 * arrives from, and admits customers whose requests leave by that same address.
 *
 * That is why the shop no longer has to tell anyone its public IP. When the ISP changes
 * it, the next heartbeat carries the new one and customers keep shopping.
 *
 * It sends no customer data and receives none. The only secret it holds is its own
 * bootstrap credential.
 *
 * Usage:
 *   SNAPUP_API_BASE=https://snapup-monorepo-production.up.railway.app \
 *   SNAPUP_AGENT_ID=spa_xxx \
 *   SNAPUP_STORE_ID=store_1 \
 *   SNAPUP_AGENT_SECRET=... \
 *   node snapup-presence-agent.mjs
 *
 * Install as a service so it restarts with the machine — see agent/README.md.
 */

import { randomBytes } from 'node:crypto';

const API_BASE = (process.env.SNAPUP_API_BASE ?? '').replace(/\/$/, '');
const AGENT_ID = process.env.SNAPUP_AGENT_ID ?? '';
const STORE_ID = process.env.SNAPUP_STORE_ID ?? '';
const SECRET = process.env.SNAPUP_AGENT_SECRET ?? '';
const VERSION = '1.0.0';

if (!API_BASE || !AGENT_ID || !STORE_ID || !SECRET) {
  console.error(
    'Missing configuration. Set SNAPUP_API_BASE, SNAPUP_AGENT_ID, SNAPUP_STORE_ID and SNAPUP_AGENT_SECRET.'
  );
  process.exit(1);
}

/** Default pace. The server returns its own preference and that wins. */
let intervalSeconds = 30;

/**
 * Consecutive failures. Used only to decide how loudly to complain: the agent keeps trying
 * for ever, because a shop whose agent gave up at 3am is a shop that cannot trade at 9.
 */
let consecutiveFailures = 0;

async function beat() {
  const started = Date.now();
  try {
    const response = await fetch(`${API_BASE}/api/store-presence/heartbeat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Agent ${SECRET}`,
      },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        store_id: STORE_ID,
        timestamp: new Date().toISOString(),
        nonce: randomBytes(16).toString('base64url'),
        agent_version: VERSION,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      consecutiveFailures += 1;
      const code = body?.error?.code ?? `http_${response.status}`;
      // A revoked or unknown agent will never succeed by retrying; say so plainly rather
      // than letting it scroll past as one more failed beat.
      if (response.status === 401) {
        console.error(
          `[agent] refused: ${code}. This agent has been revoked or its secret is wrong. ` +
            'Register a new agent in the SnapUp console and reconfigure this machine.'
        );
      } else {
        console.error(`[agent] heartbeat failed (${code}), attempt ${consecutiveFailures}`);
      }
      return;
    }

    if (typeof body?.next_heartbeat_seconds === 'number' && body.next_heartbeat_seconds > 0) {
      intervalSeconds = body.next_heartbeat_seconds;
    }

    if (consecutiveFailures > 0) {
      console.info(`[agent] recovered after ${consecutiveFailures} failed heartbeat(s)`);
    }
    consecutiveFailures = 0;
    console.info(
      `[agent] ok · store ${STORE_ID} · seen from ${body?.observed_network ?? 'unknown'} · ${Date.now() - started}ms`
    );
  } catch (error) {
    consecutiveFailures += 1;
    // The shop's own internet is down, which is exactly when this must not crash: it keeps
    // beating, and the shop comes back online by itself when the line does.
    console.error(
      `[agent] could not reach SnapUp (attempt ${consecutiveFailures}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function main() {
  console.info(`[agent] SnapUp presence agent ${VERSION} starting for ${STORE_ID}`);
  await beat();
  // Re-read the interval each time rather than using setInterval, so a server that asks
  // for a different pace is obeyed from the next beat.
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    await beat();
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.info('[agent] stopping. The store will go STALE, then OFFLINE in 90 seconds.');
    process.exit(0);
  });
}

main();
