'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'

export async function markAllNotificationsRead() {
  const session = await verifySession()
  await db.query(
    `update notifications set read_at = now()
      where profile_id = $1 and read_at is null`,
    [session.userId]
  )
  revalidatePath('/notificacoes')
}
