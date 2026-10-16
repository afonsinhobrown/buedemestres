import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Cron: fecha negociações com o turno vencido.
 * - Chamado pelo Vercel Cron (ver vercel.json) a cada minuto.
 * - Protegido por CRON_SECRET (header Authorization: Bearer <secret>).
 *   Se CRON_SECRET não estiver definido, aceita (útil em dev).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await db.query<{ n: number }>('select expire_stale_negotiations() as n');
    return NextResponse.json({ ok: true, expired: rows[0]?.n ?? 0 });
  } catch (error) {
    console.error('[cron] expire-negotiations failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
