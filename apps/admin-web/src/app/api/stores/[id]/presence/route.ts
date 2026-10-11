import { NextResponse, type NextRequest } from 'next/server';
import { callSnapupAdminApi, unreachableResponse } from '@/server/snapupApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Presence diagnostics and agent management, proxied to the gateway.
 *
 * The console holds no agent secrets of its own: registration returns a bootstrap secret
 * that passes through this route to the screen once and is never stored here.
 */
async function proxy(
  request: NextRequest,
  id: string,
  init: { method: string; body?: unknown; search?: string }
) {
  try {
    const upstream = await callSnapupAdminApi(
      `/api/admin/stores/${encodeURIComponent(id)}/presence${init.search ?? ''}`,
      { method: init.method, body: init.body }
    );
    return NextResponse.json(upstream.body, {
      status: upstream.status,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const failure = unreachableResponse(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxy(request, id, { method: 'GET' });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return proxy(request, id, { method: 'POST', body });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agentId = request.nextUrl.searchParams.get('agent_id') ?? '';
  return proxy(request, id, {
    method: 'DELETE',
    search: `?agent_id=${encodeURIComponent(agentId)}`,
  });
}
