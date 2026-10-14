'use server'

import { db } from '@/lib/db'

export async function getPendingJobs() {
  const result = await db.query(`
    SELECT 
      sj.id,
      sj.status,
      sj.provider_id,
      sj.created_at,
      sj.problem_description,
      COALESCE(p.full_name, 'Cliente Anónimo') as client_name,
      COALESCE(p.phone, 'Sem contacto') as client_phone,
      COALESCE(pp.business_name, prov_p.full_name, 'Mestre') as provider_name
    FROM service_jobs sj
    LEFT JOIN profiles p ON sj.client_id = p.id
    LEFT JOIN provider_profiles pp ON sj.provider_id = pp.profile_id
    LEFT JOIN profiles prov_p ON sj.provider_id = prov_p.id
    WHERE sj.status = 'pending' 
    ORDER BY sj.created_at DESC
  `)
  return result.rows
}

export async function getPendingRequests() {
  const result = await db.query(`
    SELECT 
      sr.id,
      sr.title,
      sr.description,
      sr.status,
      sr.urgency,
      sr.created_at,
      COALESCE(p.full_name, 'Cliente SOS') as client_name,
      COALESCE(p.phone, 'Sem contacto') as client_phone
    FROM service_requests sr
    LEFT JOIN profiles p ON sr.client_id = p.id
    WHERE sr.status = 'open' 
    ORDER BY sr.created_at DESC
  `)
  return result.rows
}

export async function getJobById(jobId: string) {
  const result = await db.query(`
    SELECT 
      sj.id,
      sj.status,
      sj.provider_id,
      sj.created_at,
      sj.problem_description,
      COALESCE(p.full_name, 'Cliente Teste') as client_name,
      COALESCE(p.phone, '') as client_phone,
      COALESCE(pp.business_name, prov_p.full_name, 'Mestre') as provider_name
    FROM service_jobs sj
    LEFT JOIN profiles p ON sj.client_id = p.id
    LEFT JOIN provider_profiles pp ON sj.provider_id = pp.profile_id
    LEFT JOIN profiles prov_p ON sj.provider_id = prov_p.id
    WHERE sj.id = $1
  `, [jobId])
  return result.rows[0] || null
}

export async function getProviders() {
  const result = await db.query(`
    SELECT 
      pp.profile_id,
      COALESCE(pp.business_name, p.full_name, 'Mestre') as business_name,
      p.full_name
    FROM provider_profiles pp
    JOIN profiles p ON pp.profile_id = p.id
    ORDER BY pp.business_name ASC
  `)
  return result.rows
}

export async function createTestJob(data: {
  clientName: string
  clientPhone: string
  problemDescription: string
  providerId: string
}) {
  let jobId = ''

  await db.transaction(async (client) => {
    // 1. Procurar ou criar cliente
    const profileRes = await client.query(
      `SELECT id FROM profiles WHERE phone = $1 LIMIT 1`,
      [data.clientPhone || '841234567']
    )

    let clientId: string
    if (profileRes.rows.length > 0) {
      clientId = profileRes.rows[0].id
    } else {
      const newProfile = await client.query(
        `INSERT INTO profiles (full_name, phone, role) VALUES ($1, $2, 'client') RETURNING id`,
        [data.clientName || 'Cliente Teste', data.clientPhone || '841234567']
      )
      clientId = newProfile.rows[0].id
    }

    // 2. Inserir trabalho com estado 'pending'
    const jobRes = await client.query(
      `INSERT INTO service_jobs (client_id, provider_id, status, client_lat, client_lng, problem_description) 
       VALUES ($1, $2, 'pending', -25.9666, 32.5833, $3) RETURNING id`,
      [clientId, data.providerId, data.problemDescription || 'Pedido de teste simulador']
    )
    jobId = jobRes.rows[0].id
  })

  return getJobById(jobId)
}

export async function acceptJob(id: string) {
  const res = await db.query(
    `UPDATE service_jobs SET status = 'accepted' WHERE id = $1 RETURNING id, status`,
    [id]
  )
  return res.rows[0]
}

export async function rejectJob(id: string) {
  const res = await db.query(
    `UPDATE service_jobs SET status = 'cancelled' WHERE id = $1 RETURNING id, status`,
    [id]
  )
  return res.rows[0]
}

export async function acceptRequest(id: string) {
  const res = await db.query(
    `UPDATE service_requests SET status = 'accepted' WHERE id = $1 RETURNING id, status`,
    [id]
  )
  return res.rows[0]
}

export async function rejectRequest(id: string) {
  const res = await db.query(
    `UPDATE service_requests SET status = 'cancelled' WHERE id = $1 RETURNING id, status`,
    [id]
  )
  return res.rows[0]
}

export async function clearOldPendingJobs() {
  await db.query(`UPDATE service_jobs SET status = 'cancelled' WHERE status = 'pending'`)
  return { success: true }
}
