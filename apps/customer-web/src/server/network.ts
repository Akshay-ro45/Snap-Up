import 'server-only';
import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { ADMIN_API_TOKEN, PRESENCE_DEV_BYPASS } from './env';
export { ipMatchesCidr } from './stores/cidr';
import { ipMatchesCidr } from './stores/cidr';
import { providerForStore } from './presence/provider';
import type { StorePresenceState } from './presence/types';
import type { StoreRecord } from './stores';

/**
 * Number of proxies in front of this app that append to `x-forwarded-for`.
 *
 * This matters for correctness, not tidiness: `x-forwarded-for` is a client-settable
 * header. An attacker can send `x-forwarded-for: 198.51.100.24` and, if we naively read
 * the leftmost entry, we would hand them a store session from their sofa. Only the
 * entries appended by infrastructure we control are trustworthy, and those are at the
 * *right* of the list. We therefore index from the right.
 *
 * On Vercel exactly one proxy (the edge network) appends the true client IP, so the
 * default of 1 means "take the last entry".
 */
const TRUSTED_PROXY_HOPS = Number(process.env.SNAPUP_TRUSTED_PROXY_HOPS ?? '1');

export function getEgressIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return null;

  const chain = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length === 0) return null;

  const index = chain.length - TRUSTED_PROXY_HOPS;
  if (index < 0) {
    // Fewer hops than configured: the chain has been truncated or spoofed. Fail closed.
    return null;
  }
  return normalizeIp(chain[index]);
}

/**
 * The address to rate-limit a sign-in attempt by.
 *
 * Usually the egress address, exactly as above. The exception is a request relayed by the
 * admin console's own server, which arrives from *its* address on behalf of a browser
 * somewhere else; keyed on that, every console sign-in shares one bucket. The console
 * passes the browser's address in `x-snapup-client-ip`, and it is believed only when the
 * same request carries the admin token in `x-snapup-relay-token` — a browser cannot set
 * that, so it cannot choose its own bucket.
 *
 * For rate limiting only. Presence is never decided by a relayed address: the console is
 * not in the shop.
 */
export function getRateLimitIp(request: NextRequest): string | null {
  const relayed = request.headers.get('x-snapup-client-ip');
  const token = request.headers.get('x-snapup-relay-token');
  if (relayed && token && relayTokenMatches(token) && isPlausibleIp(relayed)) {
    return normalizeIp(relayed);
  }
  return getEgressIp(request);
}

function relayTokenMatches(presented: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(ADMIN_API_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** IPv4 dotted quad or something IPv6-shaped. Rejects anything that could pollute a key. */
function isPlausibleIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-f:.%]{2,45}$/i.test(value);
}

/** Strips an IPv4-mapped IPv6 prefix and any zone id, so `::ffff:1.2.3.4` compares as `1.2.3.4`. */
function normalizeIp(ip: string): string {
  const withoutZone = ip.split('%')[0].trim();
  const mapped = withoutZone.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : withoutZone;
}

export type PresenceCheck =
  | { present: true; egressIp: string; storeState: StorePresenceState; via: string }
  | {
      present: false;
      reason: 'no_client_ip' | 'ip_not_authorized' | 'store_offline' | 'store_unknown' | 'store_revoked';
      storeState: StorePresenceState;
    };

/**
 * Presence factor 2: did this request physically come from inside the shop?
 *
 * The decision is delegated to a `NetworkPresenceProvider` (spec §11.4, §12.1) so that the
 * *mechanism* can change without touching the session architecture. For a store with a
 * registered Store Presence Agent the evidence is that agent's authenticated heartbeat,
 * and the address is one the server observed rather than one a human typed. For a store
 * that has no agent yet the old configured-CIDR check still applies, which is the
 * migration rule the specification sets out in §13.
 */
export async function verifyNetworkPresence(
  request: NextRequest,
  store: StoreRecord
): Promise<PresenceCheck> {
  const egressIp = getEgressIp(request);

  if (PRESENCE_DEV_BYPASS) {
    return { present: true, egressIp: egressIp ?? '127.0.0.1', storeState: 'ONLINE', via: 'dev-bypass' };
  }

  const provider = await providerForStore(store);
  const result = await provider.verifyStoreNetwork({
    storeId: store.id,
    requestNetworkIdentity: egressIp,
    now: Date.now(),
  });

  if (result.present) {
    return { present: true, egressIp: result.network, storeState: result.storeState, via: result.via };
  }

  // `network_mismatch` keeps its old name on the way out so that callers, logs and the
  // acceptance tests that already speak in terms of `ip_not_authorized` keep working.
  const reason = result.reason === 'network_mismatch' ? 'ip_not_authorized' : result.reason;
  return { present: false, reason, storeState: result.storeState };
}
