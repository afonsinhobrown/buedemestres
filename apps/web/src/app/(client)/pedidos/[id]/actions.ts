'use server'

import { db } from '@/lib/db'

export async function checkDirectJobStatus(jobId: string) {
  const result = await db.query(`
    SELECT status FROM service_jobs WHERE id = $1
  `, [jobId])
  
  return result.rows[0]?.status
}
