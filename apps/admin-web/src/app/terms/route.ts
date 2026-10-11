import { NextResponse } from 'next/server';
import { SNAPUP_API_BASE } from '@/server/snapupApi';

export const dynamic = 'force-dynamic';

/**
 * One policy, kept in one place: console users are sent to the customer app's copy rather
 * than a second one here that could drift out of step.
 *
 * A route handler rather than a page calling redirect(). The console's shell layout starts
 * streaming before a page runs, and a redirect raised after that becomes a meta-refresh
 * inside a 200 — which a crawler or link checker reads as a blank page, not a redirect.
 */
export function GET() {
  return NextResponse.redirect(`${SNAPUP_API_BASE}/terms`, 307);
}
