import 'server-only';

/**
 * How the shop's network is known to be the shop's network.
 *
 * The specification is explicit that this layer must be replaceable (§11.4): if Kurinji
 * later exposes a controller, RADIUS or router API that can attest a client is actually
 * associated with the shop's access points, that becomes a new implementation of
 * `NetworkPresenceProvider` and nothing else in the session architecture changes.
 *
 * Egress-IP comparison is what the pilot can actually do today. It is a weaker claim —
 * "this request left the same network the shop's agent is on" rather than "this device is
 * associated with this access point" — and the code says so rather than pretending
 * otherwise.
 */

/** Spec §4.4. Describes the *store's* network, not any one customer. */
export type StorePresenceState =
  /** An authenticated agent heartbeat is fresh. The gate can pass. */
  | 'ONLINE'
  /** Heartbeat is late but inside the recovery window. Existing sessions survive. */
  | 'STALE'
  /** No heartbeat for longer than the recovery window. New sessions blocked. */
  | 'OFFLINE'
  /** No agent registered for this store at all. */
  | 'UNKNOWN'
  /** Every agent for this store has been revoked. */
  | 'REVOKED';

/** The result of asking "is *this request* coming from inside this shop?" */
export type NetworkPresenceResult =
  | { present: true; network: string; storeState: StorePresenceState; via: string }
  | {
      present: false;
      storeState: StorePresenceState;
      /**
       * Why, for the server log and the console. Never shown to a customer verbatim —
       * §7.1 requires that the customer is not told which gate failed.
       */
      reason:
        | 'no_client_ip'
        | 'store_offline'
        | 'store_unknown'
        | 'store_revoked'
        | 'network_mismatch';
      network: string | null;
    };

export interface NetworkPresenceProvider {
  readonly name: string;
  verifyStoreNetwork(input: {
    storeId: string;
    /** The address this request was observed to come from. Never client-asserted. */
    requestNetworkIdentity: string | null;
    now: number;
  }): Promise<NetworkPresenceResult>;
}

/**
 * Agent health thresholds, spec §11.3.
 *
 * A heartbeat every 30 seconds; healthy for 90, which tolerates two missed beats before
 * the shop is called stale. STALE does not block an existing session — the shop is
 * demonstrably still there, the beat is just late — but it does block a *new* one, because
 * admitting a customer on evidence that has stopped arriving is the thing this prevents.
 */
export const AGENT_HEARTBEAT_INTERVAL_SECONDS = 30;
export const AGENT_ONLINE_WITHIN_SECONDS = 30;
export const AGENT_STALE_WITHIN_SECONDS = 90;

export function agentHealth(lastSeenAt: number | null, now: number): StorePresenceState {
  if (lastSeenAt === null) return 'UNKNOWN';
  const age = (now - lastSeenAt) / 1000;
  if (age <= AGENT_ONLINE_WITHIN_SECONDS) return 'ONLINE';
  if (age <= AGENT_STALE_WITHIN_SECONDS) return 'STALE';
  return 'OFFLINE';
}
