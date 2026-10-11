import 'server-only';
import { db, databaseKind } from '@/server/db/client';
import { ipMatchesCidr } from '@/server/stores/cidr';
import type { StoreRecord } from '@/server/stores';
import { agentHealth, type NetworkPresenceProvider, type NetworkPresenceResult } from './types';

/**
 * Store-network presence, decided from authenticated agent heartbeats (spec §4.3).
 *
 * The question asked is narrow and worth stating exactly: *did this request leave the same
 * network the shop's agent is currently heartbeating from?* That is weaker than "this
 * device is associated with this access point", and the specification says so itself
 * (§4.3, "Important limitation"). It is what an ordinary web client can be held to without
 * installing anything, and it is strictly stronger than the typed-in address it replaces,
 * because the value is observed on a connection from inside the shop rather than typed by
 * someone who may be describing last month's address.
 *
 * Swapping this for a controller/RADIUS integration means writing another
 * `NetworkPresenceProvider` and changing nothing else.
 */
export class StoreAgentPresenceProvider implements NetworkPresenceProvider {
  readonly name = 'store-agent';

  async verifyStoreNetwork({
    storeId,
    requestNetworkIdentity,
    now,
  }: {
    storeId: string;
    requestNetworkIdentity: string | null;
    now: number;
  }): Promise<NetworkPresenceResult> {
    if (!requestNetworkIdentity) {
      return { present: false, storeState: 'UNKNOWN', reason: 'no_client_ip', network: null };
    }
    if (databaseKind() === 'none') {
      return { present: false, storeState: 'UNKNOWN', reason: 'store_unknown', network: requestNetworkIdentity };
    }

    const rows = (await db()(
      `SELECT last_seen_at, last_observed_network, status
         FROM store_presence_agents
        WHERE store_id = $1
        ORDER BY last_seen_at DESC NULLS LAST`,
      [storeId]
    )) as { last_seen_at: string | number | null; last_observed_network: string | null; status: string }[];

    if (rows.length === 0) {
      return { present: false, storeState: 'UNKNOWN', reason: 'store_unknown', network: requestNetworkIdentity };
    }

    const live = rows.filter((row) => row.status === 'ACTIVE');
    if (live.length === 0) {
      return { present: false, storeState: 'REVOKED', reason: 'store_revoked', network: requestNetworkIdentity };
    }

    // A shop may legitimately have more than one egress path — two uplinks, or a failover
    // line — so every agent that is still beating contributes an accepted identity. They
    // are gathered from authenticated heartbeats, never typed (§11.4).
    let best: ReturnType<typeof agentHealth> = 'OFFLINE';
    for (const row of live) {
      const lastSeen = row.last_seen_at === null ? null : Number(row.last_seen_at);
      // A registered agent that has never beaten is silent, not absent.
      const raw = agentHealth(lastSeen, now);
      const health = raw === 'UNKNOWN' ? 'OFFLINE' : raw;
      if (health === 'ONLINE' || (health === 'STALE' && best !== 'ONLINE')) best = health;

      // STALE still identifies the network: the shop has not moved, its beat is merely
      // late. Blocking on that alone would close the shop over two dropped packets.
      if ((health === 'ONLINE' || health === 'STALE') && row.last_observed_network === requestNetworkIdentity) {
        return {
          present: true,
          network: requestNetworkIdentity,
          storeState: health,
          via: this.name,
        };
      }
    }

    if (best === 'OFFLINE') {
      return { present: false, storeState: 'OFFLINE', reason: 'store_offline', network: requestNetworkIdentity };
    }
    return { present: false, storeState: best, reason: 'network_mismatch', network: requestNetworkIdentity };
  }
}

/**
 * The path this replaces: addresses typed into the console as CIDR ranges.
 *
 * Kept, and used only for a store that has no agent registered yet, because the
 * specification's own migration rule (§13) is not to remove the old entry path until the
 * new one has been proven in the shop. A store with an agent never reaches this code.
 *
 * It is a deliberate transitional state, not the destination: §9.2 and §16 both rule out a
 * workflow where staff maintain the ISP address by hand, and the console no longer offers
 * one for stores that have an agent.
 */
export class ConfiguredCidrPresenceProvider implements NetworkPresenceProvider {
  readonly name = 'configured-cidr';

  constructor(private readonly store: StoreRecord) {}

  async verifyStoreNetwork({
    requestNetworkIdentity,
  }: {
    storeId: string;
    requestNetworkIdentity: string | null;
    now: number;
  }): Promise<NetworkPresenceResult> {
    if (!requestNetworkIdentity) {
      return { present: false, storeState: 'UNKNOWN', reason: 'no_client_ip', network: null };
    }

    const allowed = this.store.authorizedEgressCidrs.some((cidr) =>
      ipMatchesCidr(requestNetworkIdentity, cidr)
    );

    return allowed
      ? { present: true, network: requestNetworkIdentity, storeState: 'ONLINE', via: this.name }
      : {
          present: false,
          storeState: 'ONLINE',
          reason: 'network_mismatch',
          network: requestNetworkIdentity,
        };
  }
}

/**
 * Which provider decides for this store.
 *
 * An agent, once registered, is the authority — including when it is offline, where the
 * honest answer is "this shop cannot admit customers right now" rather than falling back
 * to a stale typed address and admitting them anyway. A silent fallback would make the
 * agent decorative.
 */
export async function providerForStore(store: StoreRecord): Promise<NetworkPresenceProvider> {
  if (databaseKind() === 'none') return new ConfiguredCidrPresenceProvider(store);

  // Any agent at all, including a revoked one. Falling back to typed addresses after a
  // revocation would make revoking an agent a no-op — the console would report REVOKED
  // while the shop carried on admitting customers on last month's address.
  const rows = (await db()(`SELECT 1 FROM store_presence_agents WHERE store_id = $1 LIMIT 1`, [
    store.id,
  ])) as unknown[];

  return rows.length > 0
    ? new StoreAgentPresenceProvider()
    : new ConfiguredCidrPresenceProvider(store);
}
