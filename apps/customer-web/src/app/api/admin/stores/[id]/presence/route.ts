import { NextResponse, type NextRequest } from 'next/server';
import { guardAdminRequest } from '@/server/adminAuth';
import { getStore } from '@/server/stores';
import { agentState, listAgents, registerAgent, revokeAgent } from '@/server/presence/agents';
import { AGENT_HEARTBEAT_INTERVAL_SECONDS, type StorePresenceState } from '@/server/presence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Presence diagnostics and agent management for one store (spec §5.1, §9.1).
 *
 * This is what replaces the "type the shop's public IP here" field. The console can see
 * whether the shop's network is reachable, when it was last seen and what address it is
 * currently using — but it cannot set that address, which is the whole point.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const store = await getStore(id);
  if (!store) return fail(404, 'store_not_found', 'No such store.');

  const now = Date.now();
  const agents = await listAgents(id);
  const states = agents.map((agent) => agentState(agent, now));

  // The store is as present as its healthiest agent: a shop with two uplinks is reachable
  // while either is beating.
  const presence: StorePresenceState = states.includes('ONLINE')
    ? 'ONLINE'
    : states.includes('STALE')
      ? 'STALE'
      : states.includes('OFFLINE')
        ? 'OFFLINE'
        : agents.length > 0
          ? 'REVOKED'
          : 'UNKNOWN';

  return NextResponse.json(
    {
      store_id: store.id,
      presence,
      // True while this store still depends on addresses typed into the console. The
      // console shows it as the thing to finish, not as a supported configuration.
      using_manual_cidrs: agents.filter((a) => a.status === 'ACTIVE').length === 0,
      configured_cidrs: store.authorizedEgressCidrs,
      heartbeat_interval_seconds: AGENT_HEARTBEAT_INTERVAL_SECONDS,
      agents: agents.map((agent, index) => ({
        id: agent.id,
        name: agent.name,
        state: states[index],
        last_seen_at: agent.lastSeenAt,
        // Operational data, shown so staff can see the ISP changed it; not editable.
        last_observed_network: agent.lastObservedNetwork,
        agent_version: agent.agentVersion,
        created_at: agent.createdAt,
        revoked_at: agent.revokedAt,
      })),
    },
    { status: 200, headers: NO_STORE }
  );
}

/** Registers an agent. The bootstrap secret in the response is shown once and never again. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const store = await getStore(id);
  if (!store) return fail(404, 'store_not_found', 'No such store.');

  let body: { agent_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'malformed_request', 'Expected a JSON body.');
  }

  const name =
    typeof body.agent_name === 'string' && body.agent_name.trim()
      ? body.agent_name.trim().slice(0, 80)
      : `${store.id}-presence`;

  const { agent, bootstrapSecret } = await registerAgent({
    storeId: store.id,
    name,
    createdBy: request.headers.get('x-snapup-actor'),
  });

  console.info(`[presence] registered agent ${agent.id} for ${store.id}`);

  return NextResponse.json(
    {
      agent_id: agent.id,
      store_id: store.id,
      agent_name: agent.name,
      // Shown once. Not retrievable afterwards — see registerAgent.
      bootstrap_secret: bootstrapSecret,
      heartbeat_url: '/api/store-presence/heartbeat',
      heartbeat_interval_seconds: AGENT_HEARTBEAT_INTERVAL_SECONDS,
    },
    { status: 201, headers: NO_STORE }
  );
}

/** Revokes an agent. The store's presence becomes REVOKED and new sessions stop. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardAdminRequest(request);
  if (!guard.ok) return guard.response;

  const agentId = request.nextUrl.searchParams.get('agent_id');
  if (!agentId) return fail(400, 'agent_id_required', 'Which agent should be revoked?');

  const revoked = await revokeAgent(agentId, request.headers.get('x-snapup-actor'));
  if (!revoked) return fail(404, 'agent_not_found', 'No such active agent.');

  const { id } = await context.params;
  console.warn(`[presence] agent ${agentId} revoked for ${id}`);
  return NextResponse.json({ revoked: true }, { status: 200, headers: NO_STORE });
}

const NO_STORE = { 'cache-control': 'no-store' };

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}
