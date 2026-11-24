import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'
import type { UserRole } from '@/types/database'

export type Viewer = {
  id: string
  role: UserRole
  name: string
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getOptionalSession()
  if (!session?.userId) return null

  try {
    const { rows } = await db.query<{
      full_name: string | null
      email: string | null
      business_name: string | null
    }>(
      `select p.full_name, p.email, pp.business_name
         from profiles p
         left join provider_profiles pp on pp.profile_id = p.id
        where p.id = $1
        limit 1`,
      [session.userId]
    )
    const row = rows[0]
    return {
      id: session.userId,
      role: session.role,
      name: row?.business_name || row?.full_name || row?.email || 'A minha conta',
    }
  } catch (error) {
    console.error('[getViewer]', error)
    return {
      id: session.userId,
      role: session.role,
      name: 'A minha conta',
    }
  }
})
