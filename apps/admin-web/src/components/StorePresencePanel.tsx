'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Store presence: what replaced "type the shop's public IP here".
 *
 * The screen is deliberately read-only about the network. It shows the address the shop is
 * currently seen from so staff can tell that the ISP changed it, and gives no way to edit
 * that value — the agent's heartbeat is the only thing that writes it (spec §9.1, §9.2).
 */

interface AgentRow {
  id: string;
  name: string;
  state: 'ONLINE' | 'STALE' | 'OFFLINE' | 'REVOKED' | 'UNKNOWN';
  last_seen_at: number | null;
  last_observed_network: string | null;
  agent_version: string | null;
  created_at: number;
  revoked_at: number | null;
}

interface Presence {
  presence: AgentRow['state'];
  using_manual_cidrs: boolean;
  configured_cidrs: string[];
  heartbeat_interval_seconds: number;
  agents: AgentRow[];
}

const TONE: Record<AgentRow['state'], string> = {
  ONLINE: 'bg-primary/15 text-primaryInk',
  STALE: 'bg-warning/20 text-ink',
  OFFLINE: 'bg-danger/10 text-danger',
  REVOKED: 'bg-danger/10 text-danger',
  UNKNOWN: 'bg-muted/15 text-muted',
};

const EXPLAIN: Record<AgentRow['state'], string> = {
  ONLINE: 'The shop’s network is being seen right now. Customers can start shopping.',
  STALE: 'The last heartbeat is late. Customers already shopping are unaffected; new sessions still work for a short while.',
  OFFLINE: 'No heartbeat. New shopping sessions are blocked until the agent is back.',
  REVOKED: 'Every agent for this shop has been revoked. New shopping sessions are blocked.',
  UNKNOWN: 'No presence agent is installed for this shop yet.',
};

export default function StorePresencePanel({ storeId }: { storeId: string }) {
  const [data, setData] = useState<Presence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Shown once, immediately after registration, and never fetched again. */
  const [newSecret, setNewSecret] = useState<{ agentId: string; secret: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/presence`, {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not load presence.');
      setData(body as Presence);
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Could not load presence.');
    }
  }, [storeId]);

  useEffect(() => {
    void load();
    // Roughly one heartbeat apart, so a screen left open tells the truth without hammering.
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/presence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_name: `${storeId}-presence` }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not register the agent.');
      setNewSecret({ agentId: body.agent_id, secret: body.bootstrap_secret });
      await load();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Could not register the agent.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(agentId: string) {
    if (!window.confirm('Revoke this agent? New shopping sessions stop until another agent is installed.')) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/stores/${encodeURIComponent(storeId)}/presence?agent_id=${encodeURIComponent(agentId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Could not revoke the agent.');
      }
      await load();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Could not revoke the agent.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return <p className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</p>;
  }
  if (!data) return <div className="h-32 animate-pulse rounded-xl bg-surface" />;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-ink">Store network presence</h2>
          <p className="mt-1 text-xs text-muted">{EXPLAIN[data.presence]}</p>
        </div>
        <span className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${TONE[data.presence]}`}>
          {data.presence}
        </span>
      </div>

      {data.using_manual_cidrs && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-xs font-extrabold text-ink">Still using a typed-in address</p>
          <p className="mt-1 text-xs leading-relaxed text-ink">
            This shop admits customers by comparing against{' '}
            <span className="font-mono">{data.configured_cidrs.join(', ') || '— nothing —'}</span>,
            which somebody has to retype whenever the ISP changes it. Install a presence agent
            and SnapUp will learn the address by itself.
          </p>
        </div>
      )}

      {newSecret && (
        <div className="mt-4 rounded-xl border border-primary/50 bg-tint px-4 py-3">
          <p className="text-xs font-extrabold text-ink">Copy this now — it is shown once</p>
          <p className="mt-2 break-all font-mono text-xs text-ink">
            SNAPUP_AGENT_ID={newSecret.agentId}
            <br />
            SNAPUP_STORE_ID={storeId}
            <br />
            SNAPUP_AGENT_SECRET={newSecret.secret}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Put these in the agent’s configuration on the shop machine. SnapUp keeps only a hash,
            so this secret cannot be shown again — if it is lost, register another agent.
          </p>
          <button
            onClick={() => setNewSecret(null)}
            className="mt-3 text-[11px] font-extrabold text-primaryInk underline underline-offset-2"
          >
            I’ve copied it
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {data.agents.length === 0 && (
          <li className="text-xs text-muted">No agent installed for this shop.</li>
        )}
        {data.agents.map((agent) => (
          <li key={agent.id} className="rounded-xl border border-border bg-bg px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-ink">{agent.name}</span>
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${TONE[agent.state]}`}>
                {agent.state}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted">
              <dt>Last seen</dt>
              <dd className="text-ink">{agent.last_seen_at ? new Date(agent.last_seen_at).toLocaleString() : 'never'}</dd>
              <dt>Seen from</dt>
              <dd className="font-mono text-ink">{agent.last_observed_network ?? '—'}</dd>
              <dt>Version</dt>
              <dd className="text-ink">{agent.agent_version ?? '—'}</dd>
            </dl>
            {agent.state !== 'REVOKED' && (
              <button
                onClick={() => void revoke(agent.id)}
                disabled={busy}
                className="mt-3 text-[11px] font-extrabold text-danger underline underline-offset-2 disabled:opacity-50"
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={() => void register()}
        disabled={busy}
        className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-xs font-extrabold text-onAccent transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Register a presence agent'}
      </button>

      {error && <p className="mt-3 text-xs font-semibold text-danger">{error}</p>}
    </section>
  );
}
