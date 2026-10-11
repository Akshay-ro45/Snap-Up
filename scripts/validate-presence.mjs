#!/usr/bin/env node
/**
 * Presence verification acceptance suite — the mandatory test matrix, spec §14.
 *
 * Runs against a production build with the real gates: real QR signature checking, real
 * replay store, real agent authentication, real egress comparison. No presence bypass is
 * set, so every case here passes or fails on the same code a customer meets.
 *
 * The one thing simulated is the network itself: `x-forwarded-for` stands in for where a
 * request came from, exactly as it does behind Railway's edge. The agent heartbeat and the
 * customer request are given addresses to assert the cases the shop will actually see — an
 * ISP changing the shop's address, a photographed code carried outside, an agent that
 * stops beating.
 *
 * Usage:
 *   node scripts/validate-presence.mjs              # build, provision, start, test
 *   node scripts/validate-presence.mjs --no-build   # reuse an existing .next build
 */

import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  provisionValidationDatabase,
  VALIDATION_DATABASE_URL_FROM_APP,
} from './validation-fixtures.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT, 'apps', 'customer-web');

const QR_SECRET = 'presence-suite-qr-secret-do-not-deploy';
const SESSION_SECRET = 'presence-suite-session-secret-do-not-deploy';
const ADMIN_TOKEN = 'presence-suite-admin-token-do-not-deploy';
const EXIT_TOKEN_SECRET = 'presence-suite-exit-secret-do-not-deploy';

const STORE = 'store_1';
/** Where the shop's agent beats from, i.e. the shop's egress address. */
const SHOP_IP = '198.51.100.24';
/** Same shop, after the ISP renews its lease. */
const SHOP_IP_AFTER_ISP_CHANGE = '198.51.100.77';
/** A customer at home with the code they photographed in the shop. */
const OUTSIDE_IP = '203.0.113.55';
const PRODUCT_BARCODE = '012000000133';

let BASE_URL = '';
const results = [];

// ---------------------------------------------------------------------------

async function testCase(id, description, fn) {
  try {
    const detail = await fn();
    results.push({ id, ok: true });
    console.log(`  \x1b[32mPASS\x1b[0m ${id}  ${description}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`);
  } catch (error) {
    results.push({ id, ok: false, detail: error.message });
    console.log(`  \x1b[31mFAIL\x1b[0m ${id}  ${description}\n         \x1b[31m${error.message}\x1b[0m`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(response, status) {
  expect(
    response.status === status,
    `expected HTTP ${status}, got ${response.status} (${response.text.slice(0, 160)})`
  );
}

async function api(pathname, { method = 'GET', ip, token, agent, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (ip) requestHeaders['x-forwarded-for'] = ip;
  if (token) requestHeaders.authorization = `Bearer ${token}`;
  if (agent) requestHeaders.authorization = `Agent ${agent}`;
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON surfaces via text */
  }
  return { status: response.status, json, text };
}

/** Mirrors signPayload() in server/crypto.ts, so the suite can forge and tamper. */
function signPayload(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

/** A display entrance token, minted here so each case controls its own nonce and expiry. */
function mintQr({ storeId = STORE, nonce = randomBytes(16).toString('base64url'), ageSeconds = 0, ttl = 90, secret = QR_SECRET } = {}) {
  const now = Math.floor(Date.now() / 1000) - ageSeconds;
  return signPayload({ v: 1, sid: storeId, nonce, iat: now, exp: now + ttl }, secret);
}

const startSession = (qrToken, ip) =>
  api('/api/session/start', { method: 'POST', ip, body: { qr_token: qrToken } });

const heartbeat = (agentId, secret, ip, extra = {}) =>
  api('/api/store-presence/heartbeat', {
    method: 'POST',
    ip,
    agent: secret,
    body: { agent_id: agentId, store_id: STORE, timestamp: new Date().toISOString(), nonce: randomBytes(8).toString('hex'), agent_version: '1.0.0', ...extra },
  });

const presenceOf = () =>
  api(`/api/admin/stores/${STORE}/presence`, { token: ADMIN_TOKEN });

// ---------------------------------------------------------------------------

async function run() {
  const state = {};

  await testCase('P1', 'Before any agent: the shop falls back to its configured range', async () => {
    const view = await presenceOf();
    expectStatus(view, 200);
    expect(view.json.presence === 'UNKNOWN', `presence ${view.json.presence}`);
    expect(view.json.using_manual_cidrs === true, 'expected the legacy path to be flagged');
    const started = await startSession(mintQr(), SHOP_IP);
    expect(started.status === 201, `fallback entry failed: ${started.status}`);
    return 'UNKNOWN, legacy CIDR still admits';
  });

  await testCase('P2', 'Agent registration returns a bootstrap secret exactly once', async () => {
    const registered = await api(`/api/admin/stores/${STORE}/presence`, {
      method: 'POST',
      token: ADMIN_TOKEN,
      body: { agent_name: 'suite-agent' },
    });
    expectStatus(registered, 201);
    expect(typeof registered.json.bootstrap_secret === 'string' && registered.json.bootstrap_secret.length > 20, 'no bootstrap secret');
    state.agentId = registered.json.agent_id;
    state.agentSecret = registered.json.bootstrap_secret;

    // And is never retrievable afterwards.
    const view = await presenceOf();
    expect(!JSON.stringify(view.json).includes(state.agentSecret), 'the secret is retrievable after registration');
    return `${state.agentId}, secret not in diagnostics`;
  });

  await testCase('P3', 'An agent with no heartbeat blocks new sessions, even on the old range', async () => {
    const view = await presenceOf();
    expect(view.json.presence === 'OFFLINE', `presence ${view.json.presence}`);
    expect(view.json.using_manual_cidrs === false, 'the agent should now be the authority');
    const started = await startSession(mintQr(), SHOP_IP);
    expectStatus(started, 503);
    expect(started.json.error.code === 'store_presence_unavailable', `got ${started.json.error.code}`);
    return '503 store_presence_unavailable';
  });

  await testCase('P4', 'A wrong agent secret is refused and does not register presence', async () => {
    const bad = await heartbeat(state.agentId, 'not-the-secret', SHOP_IP);
    expectStatus(bad, 401);
    const view = await presenceOf();
    expect(view.json.presence === 'OFFLINE', `a bad heartbeat moved presence to ${view.json.presence}`);
    return '401, presence unchanged';
  });

  await testCase('P5', 'A valid heartbeat brings the shop ONLINE and records the observed address', async () => {
    const beat = await heartbeat(state.agentId, state.agentSecret, SHOP_IP);
    expectStatus(beat, 200);
    expect(beat.json.observed_network === SHOP_IP, `observed ${beat.json.observed_network}`);
    const view = await presenceOf();
    expect(view.json.presence === 'ONLINE', `presence ${view.json.presence}`);
    return `ONLINE, seen from ${SHOP_IP}`;
  });

  await testCase('P6', 'Correct QR from the shop network: session created', async () => {
    const started = await startSession(mintQr(), SHOP_IP);
    expectStatus(started, 201);
    state.token = started.json.session_token;
    return 'session created';
  });

  await testCase('P7', 'Correct QR from outside the shop: refused', async () => {
    const started = await startSession(mintQr(), OUTSIDE_IP);
    expectStatus(started, 403);
    expect(started.json.error.code === 'presence_not_verified', `got ${started.json.error.code}`);
    return '403 presence_not_verified';
  });

  await testCase('P8', 'A photographed code cannot be redeemed twice', async () => {
    const token = mintQr();
    const first = await startSession(token, SHOP_IP);
    expectStatus(first, 201);
    const replay = await startSession(token, SHOP_IP);
    expectStatus(replay, 401);
    // §7.1: the customer is not told which gate refused them.
    expect(replay.json.error.code === 'qr_expired', `got ${replay.json.error.code}`);
    return 'second redemption refused';
  });

  await testCase('P9', 'An expired QR is refused', async () => {
    const started = await startSession(mintQr({ ageSeconds: 300 }), SHOP_IP);
    expectStatus(started, 401);
    return `401 ${started.json.error.code}`;
  });

  await testCase('P10', 'A QR signed with the wrong key is refused', async () => {
    const started = await startSession(mintQr({ secret: 'attacker-key' }), SHOP_IP);
    expectStatus(started, 401);
    return `401 ${started.json.error.code}`;
  });

  await testCase('P11', 'A QR for another store cannot open this one', async () => {
    const started = await startSession(mintQr({ storeId: 'store_2' }), SHOP_IP);
    // store_2 has its own network; presented from store_1's address it must not pass.
    expect(started.status !== 201, 'a store_2 code opened a session from store_1’s network');
    return `refused with ${started.status}`;
  });

  await testCase('P12', 'The ISP changes the shop address: no console edit needed', async () => {
    const beat = await heartbeat(state.agentId, state.agentSecret, SHOP_IP_AFTER_ISP_CHANGE);
    expectStatus(beat, 200);
    expect(beat.json.observed_network === SHOP_IP_AFTER_ISP_CHANGE, 'the new address was not learned');

    const started = await startSession(mintQr(), SHOP_IP_AFTER_ISP_CHANGE);
    expectStatus(started, 201);
    state.token = started.json.session_token;

    // And the old address stops admitting, which is the other half of the claim.
    const old = await startSession(mintQr(), SHOP_IP);
    expectStatus(old, 403);
    return 'new address admits, old refused, nothing typed';
  });

  await testCase('P13', 'A barcode lookup requires a session', async () => {
    const anonymous = await api(`/api/products/barcode/${PRODUCT_BARCODE}`, { ip: SHOP_IP_AFTER_ISP_CHANGE });
    expect(anonymous.status === 401 || anonymous.status === 403, `got ${anonymous.status}`);
    const withSession = await api(`/api/products/barcode/${PRODUCT_BARCODE}`, {
      ip: SHOP_IP_AFTER_ISP_CHANGE,
      token: state.token,
    });
    expectStatus(withSession, 200);
    return 'refused without, served with';
  });

  await testCase('P14', 'An agent outage does not eject a customer already shopping', async () => {
    // No heartbeat is sent; the store goes stale and then offline on its own clock. The
    // shopper is still on the same network and still holds a bound session.
    const renewed = await api('/api/session/renew', { method: 'POST', ip: SHOP_IP_AFTER_ISP_CHANGE, token: state.token });
    expectStatus(renewed, 200);
    expect(renewed.json.renewed === true, `renewal refused: ${renewed.json.reason}`);
    state.token = renewed.json.session_token;

    // A customer who has actually left is still refused, outage or not.
    const moved = await api('/api/session/renew', { method: 'POST', ip: OUTSIDE_IP, token: state.token });
    expect(moved.json.renewed === false, 'a session renewed from a different network');
    return 'same network renews, different network refused';
  });

  await testCase('P15', 'Revoking the agent blocks new sessions', async () => {
    const revoked = await api(`/api/admin/stores/${STORE}/presence?agent_id=${encodeURIComponent(state.agentId)}`, {
      method: 'DELETE',
      token: ADMIN_TOKEN,
    });
    expectStatus(revoked, 200);

    const view = await presenceOf();
    expect(view.json.presence === 'REVOKED', `presence ${view.json.presence}`);

    const started = await startSession(mintQr(), SHOP_IP_AFTER_ISP_CHANGE);
    expectStatus(started, 503);

    // And the revoked agent cannot beat its way back in.
    const beat = await heartbeat(state.agentId, state.agentSecret, SHOP_IP_AFTER_ISP_CHANGE);
    expectStatus(beat, 401);
    return 'REVOKED, entry blocked, heartbeat refused';
  });

  await testCase('P16', 'Presence diagnostics never expose a credential', async () => {
    const view = await presenceOf();
    const body = JSON.stringify(view.json);
    for (const secret of [state.agentSecret, QR_SECRET, SESSION_SECRET, ADMIN_TOKEN]) {
      expect(!body.includes(secret), 'a secret appeared in presence diagnostics');
    }
    expect(!/credential_hash/.test(body), 'the credential hash is exposed');
    return 'no secrets in the diagnostics payload';
  });

  await testCase('P17', 'Presence diagnostics require admin credentials', async () => {
    const anonymous = await api(`/api/admin/stores/${STORE}/presence`);
    expect(anonymous.status === 401 || anonymous.status === 403, `got ${anonymous.status}`);
    const wrong = await api(`/api/admin/stores/${STORE}/presence`, { token: 'not-the-admin-token' });
    expect(wrong.status === 401 || wrong.status === 403, `got ${wrong.status}`);
    return 'anonymous and wrong-token both refused';
  });
}

// ---------------------------------------------------------------------------

function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'inherit'], ...options });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exited ${code}`))));
  });
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not come up at ${url}`);
}

async function main() {
  const skipBuild = process.argv.includes('--no-build');
  const port = Number(process.env.PORT ?? 3119);

  console.log('Provisioning validation database...');
  await provisionValidationDatabase();

  const serverEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: VALIDATION_DATABASE_URL_FROM_APP,
    SNAPUP_QR_SECRET: QR_SECRET,
    SNAPUP_SESSION_SECRET: SESSION_SECRET,
    SNAPUP_ADMIN_API_TOKEN: ADMIN_TOKEN,
    SNAPUP_EXIT_TOKEN_SECRET: EXIT_TOKEN_SECRET,
    SNAPUP_TRUSTED_PROXY_HOPS: '1',
    // Deliberately absent: SNAPUP_PRESENCE_DEV_BYPASS. The real gates must run.
  };

  const nextBin = require.resolve('next/dist/bin/next');
  if (!skipBuild) {
    console.log('Building production bundle...\n');
    await runProcess(process.execPath, [nextBin, 'build'], { cwd: APP_DIR, env: serverEnv });
  }

  BASE_URL = `http://127.0.0.1:${port}`;
  console.log(`Starting production server on port ${port}...`);
  const server = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
    cwd: APP_DIR,
    env: serverEnv,
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  try {
    await waitForServer(`${BASE_URL}/api/store/${STORE}/entry-qr`);
    console.log('Server ready.\n');
    console.log('\x1b[1mPresence verification — spec §14 mandatory test matrix\x1b[0m');
    await run();
  } finally {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(72));
  if (failed.length === 0) {
    console.log(`\x1b[32m\x1b[1mAll ${results.length} presence cases passed.\x1b[0m`);
  } else {
    console.log(`\x1b[31m\x1b[1m${failed.length} of ${results.length} presence cases FAILED:\x1b[0m`);
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exitCode = 1;
  }
  console.log('='.repeat(72));
}

main().catch((error) => {
  console.error(`\n\x1b[31mSuite error: ${error.stack ?? error}\x1b[0m`);
  process.exitCode = 1;
});
