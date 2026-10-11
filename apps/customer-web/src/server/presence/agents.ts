import 'server-only';
import { randomBytes } from 'crypto';
import { db, databaseKind, toEpochMsOrNull } from '@/server/db/client';
import { hashPassword, verifyPassword } from '@/server/accounts/password';
import { agentHealth, type StorePresenceState } from './types';

/**
 * Registration, authentication and heartbeat for Store Presence Agents (spec §11).
 *
 * The agent is the only thing that writes a store's network identity. No console screen
 * accepts one, which is the point: the address changes when the ISP decides it changes,
 * and a system that needs a human to notice is a system that fails quietly at the worst
 * moment.
 */

export interface AgentRecord {
  id: string;
  storeId: string;
  name: string;
  lastSeenAt: number | null;
  lastObservedNetwork: string | null;
  agentVersion: string | null;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: number;
  revokedAt: number | null;
}

/**
 * Derived, never stored: a row cannot claim to be live when its heartbeat stopped.
 *
 * An agent that has been registered but has never beaten is OFFLINE, not UNKNOWN. UNKNOWN
 * means "this shop has no agent"; an agent that exists and is silent is a shop that cannot
 * admit anyone, and saying so is the point.
 */
export function agentState(agent: AgentRecord, now: number): StorePresenceState {
  if (agent.status === 'REVOKED') return 'REVOKED';
  const health = agentHealth(agent.lastSeenAt, now);
  return health === 'UNKNOWN' ? 'OFFLINE' : health;
}

function toAgent(row: Record<string, unknown>): AgentRecord {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    lastSeenAt: toEpochMsOrNull(row.last_seen_at),
    lastObservedNetwork: (row.last_observed_network as string | null) ?? null,
    agentVersion: (row.agent_version as string | null) ?? null,
    status: row.status as 'ACTIVE' | 'REVOKED',
    createdAt: Number(row.created_at),
    revokedAt: toEpochMsOrNull(row.revoked_at),
  };
}

const SELECT = `SELECT id, store_id, name, last_seen_at, last_observed_network, agent_version,
                       status, created_at, revoked_at
                  FROM store_presence_agents`;

export async function listAgents(storeId: string): Promise<AgentRecord[]> {
  if (databaseKind() === 'none') return [];
  const rows = (await db()(`${SELECT} WHERE store_id = $1 ORDER BY created_at DESC`, [
    storeId,
  ])) as Record<string, unknown>[];
  return rows.map(toAgent);
}

/**
 * Registers an agent and returns its bootstrap secret **once**.
 *
 * The secret is shown to the operator at this moment and never again (§11.1); only its
 * hash is stored. Losing it means registering a new agent, which is the correct trade: a
 * secret a console can redisplay is a secret anyone with console access can walk away
 * with.
 */
export async function registerAgent(input: {
  storeId: string;
  name: string;
  createdBy: string | null;
}): Promise<{ agent: AgentRecord; bootstrapSecret: string }> {
  const id = `spa_${randomBytes(9).toString('base64url')}`;
  const bootstrapSecret = randomBytes(32).toString('base64url');
  const credentialHash = await hashPassword(bootstrapSecret);
  const now = Date.now();

  const rows = (await db()(
    `INSERT INTO store_presence_agents (id, store_id, name, credential_hash, status, created_at, created_by)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
     RETURNING id, store_id, name, last_seen_at, last_observed_network, agent_version, status, created_at, revoked_at`,
    [id, input.storeId, input.name, credentialHash, now, input.createdBy]
  )) as Record<string, unknown>[];

  return { agent: toAgent(rows[0]), bootstrapSecret };
}

export async function revokeAgent(agentId: string, revokedBy: string | null): Promise<boolean> {
  const rows = (await db()(
    `UPDATE store_presence_agents
        SET status = 'REVOKED', revoked_at = $2, revoked_by = $3
      WHERE id = $1 AND status <> 'REVOKED'
      RETURNING id`,
    [agentId, Date.now(), revokedBy]
  )) as { id: string }[];
  return rows.length > 0;
}

export type HeartbeatOutcome =
  | { ok: true; agent: AgentRecord; nextHeartbeatSeconds: number }
  | { ok: false; reason: 'unknown_agent' | 'revoked' | 'bad_credential' | 'store_mismatch' | 'clock_skew' | 'no_network' };

/** Spec §11.2: how far an agent's clock may be from ours before the beat is refused. */
const MAX_CLOCK_SKEW_SECONDS = 120;

/**
 * Records a heartbeat, and with it the address the request was *observed* to come from.
 *
 * The agent does not tell us its address and is not believed if it tries: the value stored
 * is the one the edge saw on the connection, which is the only part a compromised agent
 * cannot choose.
 */
export async function recordHeartbeat(input: {
  agentId: string;
  storeId: string;
  credential: string;
  observedNetwork: string | null;
  timestamp: number | null;
  agentVersion: string | null;
}): Promise<HeartbeatOutcome> {
  if (databaseKind() === 'none') return { ok: false, reason: 'unknown_agent' };

  const rows = (await db()(
    `SELECT id, store_id, name, credential_hash, last_seen_at, last_observed_network,
            agent_version, status, created_at, revoked_at
       FROM store_presence_agents WHERE id = $1`,
    [input.agentId]
  )) as Record<string, unknown>[];

  const row = rows[0];
  // Hash a dummy when the agent is unknown, so a wrong id and a wrong secret take the
  // same time to refuse and the pair cannot be told apart by timing.
  if (!row) {
    await verifyPassword(input.credential, null);
    return { ok: false, reason: 'unknown_agent' };
  }

  const matches = await verifyPassword(input.credential, row.credential_hash as string);
  if (!matches) return { ok: false, reason: 'bad_credential' };
  if (row.status === 'REVOKED') return { ok: false, reason: 'revoked' };
  if (row.store_id !== input.storeId) return { ok: false, reason: 'store_mismatch' };

  if (input.timestamp !== null) {
    const skew = Math.abs(Date.now() - input.timestamp) / 1000;
    if (skew > MAX_CLOCK_SKEW_SECONDS) return { ok: false, reason: 'clock_skew' };
  }

  // An agent whose address we cannot observe proves nothing; recording the beat would mark
  // the shop ONLINE with no network to compare a customer against.
  if (!input.observedNetwork) return { ok: false, reason: 'no_network' };

  const now = Date.now();
  const updated = (await db()(
    `UPDATE store_presence_agents
        SET last_seen_at = $2, last_observed_network = $3, agent_version = $4
      WHERE id = $1
      RETURNING id, store_id, name, last_seen_at, last_observed_network, agent_version, status, created_at, revoked_at`,
    [input.agentId, now, input.observedNetwork, input.agentVersion]
  )) as Record<string, unknown>[];

  return {
    ok: true,
    agent: toAgent(updated[0]),
    nextHeartbeatSeconds: 30,
  };
}
