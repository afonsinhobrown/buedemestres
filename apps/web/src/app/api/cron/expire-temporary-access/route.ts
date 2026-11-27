import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rows } = await db.query<{ expire_temporary_provider_access: number }>(
      'select expire_temporary_provider_access()'
    )
    return NextResponse.json({ ok: true, expired: rows[0]?.expire_temporary_provider_access ?? 0 })
  } catch (error) {
    console.error('[cron/expire-temporary-access]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
