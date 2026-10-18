'use server'

import { db } from '@/lib/db'
import { normalizeRequestStatus } from '@/lib/job-flow'

export async function checkDirectJobStatus(identifier: string) {
  const job = await db.query(`
    SELECT status FROM jobs WHERE id = $1 OR request_id = $1 LIMIT 1
  `, [identifier])

  if (job.rows[0]?.status) return job.rows[0].status as string

  const request = await db.query(`
    SELECT status FROM service_requests WHERE id = $1 LIMIT 1
  `, [identifier])

  return normalizeRequestStatus(request.rows[0]?.status)
}
