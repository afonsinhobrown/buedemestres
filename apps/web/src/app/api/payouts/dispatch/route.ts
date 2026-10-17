import { NextResponse } from 'next/server';
import { dispatchPayout } from '@/lib/payouts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const payoutId: string | undefined = body.payoutId;
  if (!payoutId) return NextResponse.json({ ok: false, error: 'payoutId em falta' }, { status: 400 });

  const result = await dispatchPayout(payoutId, new URL(req.url).origin);
  return NextResponse.json({ ok: result !== 'failed', result });
}
