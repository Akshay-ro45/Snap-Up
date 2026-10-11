import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness for the console.
 *
 * Answers 200 whenever the process is serving, exactly like the gateway's own probe and
 * for the same reason: a console with nothing configured yet is not a failed deployment,
 * and a probe that failed on unfinished configuration would restart a working container
 * for ever. Read the body for readiness; the status code is about the process.
 *
 * The two variables reported here are the whole of the console's configuration. Neither
 * value is echoed — `SNAPUP_ADMIN_API_TOKEN` is a machine credential, and a health
 * endpoint is unauthenticated by design, so this says only whether it is present.
 */
export async function GET(request: NextRequest) {
  const apiBase = process.env.SNAPUP_API_BASE ?? null;
  const hasToken = Boolean(process.env.SNAPUP_ADMIN_API_TOKEN);

  const warnings: string[] = [];
  if (!apiBase) {
    warnings.push('SNAPUP_API_BASE is not set — the console has no gateway to talk to.');
  }
  if (!hasToken) {
    warnings.push('SNAPUP_ADMIN_API_TOKEN is not set — every registry write will be refused.');
  }

  // Anonymous callers get liveness only. `api_base` names an internal host and the
  // warnings describe where this deployment is misconfigured; neither is a secret, and
  // neither is anyone's business but the operator's.
  const authorized = (() => {
    const header = request.headers.get('authorization') ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const expected = process.env.SNAPUP_ADMIN_API_TOKEN ?? '';
    if (!presented || !expected) return false;
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  })();

  if (!authorized) {
    return NextResponse.json(
      { status: 'ok' },
      { status: 200, headers: { 'cache-control': 'no-store' } }
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      app: 'admin-web',
      api_base: apiBase,
      admin_token_present: hasToken,
      warnings,
      console_ready: warnings.length === 0,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } }
  );
}
