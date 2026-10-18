'use server'

import { db } from '@/lib/db'

export async function checkDirectJobStatus(identifier: string) {
  const result = await db.query(`
    SELECT status FROM jobs WHERE id = $1 OR request_id = $1 LIMIT 1
  `, [identifier])

  return result.rows[0]?.status
}
