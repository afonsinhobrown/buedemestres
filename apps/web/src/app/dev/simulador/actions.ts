'use server'

import { db } from '@/lib/db'

export async function getPendingJobs() {
  const result = await db.query(`
    SELECT id, status, provider_id, created_at 
    FROM service_jobs 
    WHERE status = 'pending' 
    ORDER BY created_at DESC
  `)
  return result.rows
}

export async function getPendingRequests() {
  const result = await db.query(`
    SELECT id, title, description, status, created_at 
    FROM service_requests 
    WHERE status = 'pending' 
    ORDER BY created_at DESC
  `)
  return result.rows
}

export async function acceptJob(id: string) {
  await db.query(`UPDATE service_jobs SET status = 'accepted' WHERE id = $1`, [id])
}

export async function acceptRequest(id: string) {
  await db.query(`UPDATE service_requests SET status = 'accepted' WHERE id = $1`, [id])
}
