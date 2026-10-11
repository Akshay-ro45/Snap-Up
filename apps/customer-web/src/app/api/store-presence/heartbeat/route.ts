import { NextResponse, type NextRequest } from 'next/server';
import { getEgressIp } from '@/server/network';
import { recordHeartbeat } from '@/server/presence/agents';
import { consumeToken } from '@/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Store Presence Agent heartbeat (spec §11.2).
 *
 * This is the one place the shop's network identity is learned, and it is learned by
 * observation: the address recorded is the one this request arrived from, never one the
 * agent claims. An agent whose machine is compromised can stop the shop trading — it can
 * withhold beats — but it cannot move the shop to a different network, because it does not
 * get to say where it is.
 *
 * Authenticated with the bootstrap secret issued at registration, which is checked against
 * a stored hash. There is no customer data here in either direction (§4.2).
 */
export async function POST(request: NextRequest) {
  let body: {
    agent_id?: unknown;
    store_id?: unknown;
    timestamp?: unknown;
    nonce?: unknown;
    agent_version?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'malformed_request', 'Expected a JSON body.');
  }

  const agentId = typeof body.agent_id === 'string' ? body.agent_id : '';
  const storeId = typeof body.store_id === 'string' ? body.store_id : '';
  const credential = extractAgentCredential(request);

  if (!agentId || !storeId || !credential) {
    return fail(401, 'agent_unauthenticated', 'Agent credentials are required.');
  }

  // Generous, because a healthy agent beats every 30 seconds and a restarting one may beat
  // twice in quick succession. Tight enough that a stolen credential cannot be used to
  // hammer the hash comparison.
  const limit = await consumeToken(`agent-heartbeat:${agentId}`, 10, 1 / 5);
  if (!limit.allowed) {
    return fail(429, 'rate_limited', 'Too many heartbeats.', {
      'retry-after': String(limit.retryAfterSeconds),
    });
  }

  const outcome = await recordHeartbeat({
    agentId,
    storeId,
    credential,
    observedNetwork: getEgressIp(request),
    timestamp: typeof body.timestamp === 'string' ? Date.parse(body.timestamp) : null,
    agentVersion: typeof body.agent_version === 'string' ? body.agent_version.slice(0, 40) : null,
  });

  if (!outcome.ok) {
    // One message for every authentication failure, so a caller cannot tell a wrong agent
    // id from a wrong secret. `clock_skew` and `no_network` are operator problems rather
    // than credential problems and are named, because the person reading them is the one
    // who installed the agent.
    if (outcome.reason === 'clock_skew') {
      return fail(400, 'clock_skew', 'The agent clock is too far from server time.');
    }
    if (outcome.reason === 'no_network') {
      return fail(400, 'no_observable_network', 'Could not observe a source address for this heartbeat.');
    }
    console.warn(`[presence] heartbeat refused for ${agentId}: ${outcome.reason}`);
    return fail(401, 'agent_unauthenticated', 'Agent credentials are not valid.');
  }

  return NextResponse.json(
    {
      ok: true,
      next_heartbeat_seconds: outcome.nextHeartbeatSeconds,
      observed_network: outcome.agent.lastObservedNetwork,
    },
    { status: 200, headers: NO_STORE }
  );
}

/** `Authorization: Agent <secret>`, per the spec's heartbeat example. */
function extractAgentCredential(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Agent\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

const NO_STORE = { 'cache-control': 'no-store' };

function fail(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...NO_STORE, ...headers } }
  );
}
