import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rows } = await db.query<{
      id: number
      name: string
      parent_name: string | null
    }>(
      `select c.id, c.name, p.name as parent_name
         from categories c
         left join categories p on p.id = c.parent_id
        where c.is_active = true
        order by coalesce(p.sort_order, c.sort_order), c.sort_order, c.name`
    )

    return NextResponse.json(rows.map((row) => ({
      id: Number(row.id),
      name: row.parent_name ? `${row.parent_name} · ${row.name}` : row.name,
    })))
  } catch (error) {
    console.error('[api/categories]', error)
    return NextResponse.json([], { status: 500 })
  }
}
