import 'server-only';
import { createHash } from 'crypto';
import { db, databaseKind } from '@/server/db/client';

/**
 * One entrance code, one session (spec §3.3, §6.5).
 *
 * The rotating display code already expires in seconds, which stops it being useful
 * tomorrow. This stops it being useful *twice in the same minute*: photographed off the
 * screen inside the shop and handed to someone in the car park, a code with no replay
 * record would admit both people. The network gate still stands behind it — the second
 * person is on a different network — but a gate that only works because the one behind it
 * does is not a gate.
 *
 * The nonce is stored hashed. It is not a secret worth much, but a table of live tokens in
 * plaintext is a table worth stealing, and hashing costs nothing here.
 */

function hashNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('base64url');
}

export type ClaimResult = 'claimed' | 'replayed' | 'unavailable';

/**
 * Claims a nonce for this entry attempt.
 *
 * `INSERT … ON CONFLICT DO NOTHING` makes the claim atomic: two requests racing with the
 * same photographed code resolve to exactly one insert, and the loser is told it is a
 * replay. A check-then-insert would let both through.
 *
 * Returns `unavailable` when there is no database to record in — the caller decides what
 * that means, and for the entry gate it means carry on, because refusing every customer
 * because an anti-replay table is missing would be a worse failure than the one it
 * prevents.
 */
export async function claimQrNonce(input: {
  nonce: string;
  storeId: string;
  expiresAt: number;
}): Promise<ClaimResult> {
  if (databaseKind() === 'none') return 'unavailable';

  const sql = db();
  const now = Date.now();

  try {
    const rows = (await sql(
      `INSERT INTO qr_replay_nonces (nonce_hash, store_id, used_at, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nonce_hash) DO NOTHING
       RETURNING nonce_hash`,
      [hashNonce(input.nonce), input.storeId, now, input.expiresAt]
    )) as unknown[];

    if (rows.length === 0) return 'replayed';

    // Opportunistic sweep: a row is dead once the token it refers to has expired, and
    // deleting on the write path keeps the table the size of one rotation window without
    // needing a scheduled job.
    await sql(`DELETE FROM qr_replay_nonces WHERE expires_at < $1`, [now]);
    return 'claimed';
  } catch (error) {
    // An unmigrated database is the expected case on a deployment that has not run the
    // migration yet. Loud in the log, open at the door — see above.
    console.warn('[presence] could not record QR nonce; replay protection inactive', error);
    return 'unavailable';
  }
}
