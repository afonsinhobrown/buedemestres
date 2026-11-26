import { NextResponse } from 'next/server';
import { dispatchPayout } from '@/lib/payouts';
import { requireApiActor } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const payoutId: string | undefined = body.payoutId;
  if (!payoutId) return NextResponse.json({ ok: false, error: 'payoutId em falta' }, { status: 400 });

  const secret = process.env.PUSH_DISPATCH_SECRET;
  const isWorker = Boolean(secret) && req.headers.get('x-push-secret') === secret;

  if (!isWorker) {
    const auth = await requireApiActor(req);
    if (!auth.actor) return auth.response;
    if (!['admin', 'superadmin', 'finance'].includes(auth.actor.role)) {
      return NextResponse.json({ ok: false, error: 'Sem permissão.' }, { status: 403 });
    }
  }

  const result = await dispatchPayout(payoutId, new URL(req.url).origin);
  return NextResponse.json({ ok: result !== 'failed', result });
}
