'use server'

import { db } from '@/lib/db'

// Comissão da plataforma (simulador). Em produção vem do plano do mestre / system_settings.
const COMMISSION_RATE = 0.1

const JOB_SELECT = `
  SELECT
    sj.id, sj.status, sj.provider_id, sj.created_at,
    sj.problem_description, sj.reference_point,
    sj.client_lat, sj.client_lng,
    sj.quoted_price, sj.quote_items, sj.payment_status,
    sj.payment_method, sj.commission_amount,
    COALESCE(p.full_name, 'Cliente') as client_name,
    COALESCE(p.phone, '') as client_phone,
    COALESCE(pp.business_name, prov_p.full_name, 'Mestre') as provider_name,
    pp.lat as provider_lat, pp.lng as provider_lng
  FROM service_jobs sj
  LEFT JOIN profiles p ON sj.client_id = p.id
  LEFT JOIN provider_profiles pp ON sj.provider_id = pp.profile_id
  LEFT JOIN profiles prov_p ON sj.provider_id = prov_p.id
`

// Trabalhos activos (tudo o que não está fechado) — visão do mestre
export async function getActiveJobs() {
  const result = await db.query(`
    ${JOB_SELECT}
    WHERE sj.status NOT IN ('completed', 'cancelled', 'rejected')
    ORDER BY sj.created_at DESC
    LIMIT 30
  `)
  return result.rows
}

export async function getPendingRequests() {
  const result = await db.query(`
    SELECT sr.id, sr.title, sr.description, sr.status, sr.created_at
    FROM service_requests sr
    WHERE sr.status = 'open'
    ORDER BY sr.created_at DESC
  `)
  return result.rows
}

export async function getJobById(jobId: string) {
  const result = await db.query(`${JOB_SELECT} WHERE sj.id = $1`, [jobId])
  return result.rows[0] || null
}

export async function getProviders() {
  const result = await db.query(`
    SELECT pp.profile_id,
           COALESCE(pp.business_name, p.full_name, 'Mestre') as business_name,
           p.full_name,
           pp.category_id,
           COALESCE(c.name, 'Geral') as category_name
    FROM provider_profiles pp
    JOIN profiles p ON pp.profile_id = p.id
    LEFT JOIN categories c ON pp.category_id = c.id
    ORDER BY pp.business_name ASC
  `)
  return result.rows
}

// 1. CLIENTE: cria pedido com GPS + ponto de referência
export async function createTestJob(data: {
  clientName: string
  clientPhone: string
  problemDescription: string
  referencePoint: string
  lat: number
  lng: number
  providerId: string
}) {
  let jobId = ''
  await db.transaction(async (client) => {
    const phone = data.clientPhone || '841234567'
    const profileRes = await client.query(`SELECT id FROM profiles WHERE phone = $1 LIMIT 1`, [phone])
    let clientId: string
    if (profileRes.rows.length > 0) {
      clientId = profileRes.rows[0].id
    } else {
      const np = await client.query(
        `INSERT INTO profiles (full_name, phone, role) VALUES ($1, $2, 'client') RETURNING id`,
        [data.clientName || 'Cliente Teste', phone]
      )
      clientId = np.rows[0].id
    }
    const jobRes = await client.query(
      `INSERT INTO service_jobs
         (client_id, provider_id, status, client_lat, client_lng, problem_description, reference_point)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6) RETURNING id`,
      [clientId, data.providerId, data.lat, data.lng, data.problemDescription, data.referencePoint || null]
    )
    jobId = jobRes.rows[0].id
  })
  return getJobById(jobId)
}

// Transição segura: só muda se o estado actual for o esperado (evita saltos inválidos)
async function transition(id: string, from: string[], to: string, extra = '', params: unknown[] = []) {
  const res = await db.query(
    `UPDATE service_jobs SET status = $2, updated_at = now() ${extra}
     WHERE id = $1 AND status = ANY($3::text[]) RETURNING id`,
    [id, to, from, ...params]
  )
  if (res.rowCount === 0) {
    throw new Error(`Transição inválida para "${to}". O pedido já mudou de estado.`)
  }
  return getJobById(id)
}

// 2. MESTRE: aceita / recusa
export async function acceptJob(id: string) {
  return transition(id, ['pending'], 'accepted')
}
export async function rejectJob(id: string) {
  return transition(id, ['pending'], 'cancelled')
}

// 3. MESTRE: sai para o local
export async function startTravel(id: string) {
  return transition(id, ['accepted'], 'em_deslocacao')
}

// 4. MESTRE: chegou, diagnosticou e propõe orçamento
export async function proposeQuote(id: string, items: { description: string; price: number }[]) {
  const valid = items.filter(i => i.description.trim() && i.price > 0)
  if (valid.length === 0) throw new Error('O orçamento precisa de pelo menos uma linha com preço.')
  const total = valid.reduce((s, i) => s + i.price, 0)
  return transition(
    id,
    ['em_deslocacao', 'negotiating'],
    'negotiating',
    `, quoted_price = $4, quote_items = $5::jsonb`,
    [total, JSON.stringify(valid)]
  )
}

// 5a. CLIENTE: recusa orçamento → mestre pode propor outro
export async function rejectQuote(id: string) {
  return transition(id, ['negotiating'], 'em_deslocacao', `, quoted_price = NULL, quote_items = NULL`)
}

import { calculateLoyaltyPricing } from '@/lib/loyalty'

// 5b. CLIENTE: aceita e paga (SIMULADO) → valor retido com políticas de retenção
export async function payQuote(id: string, method: string) {
  const job = await getJobById(id)
  if (!job?.quoted_price) throw new Error('Sem orçamento para pagar.')

  // Contar trabalhos concluídos anteriormente pelo cliente e pelo mestre
  const clientCountRes = await db.query(
    `SELECT COUNT(*)::int as count FROM service_jobs WHERE client_id = (SELECT client_id FROM service_jobs WHERE id = $1) AND status = 'completed'`,
    [id]
  )
  const provCountRes = await db.query(
    `SELECT COUNT(*)::int as count FROM service_jobs WHERE provider_id = (SELECT provider_id FROM service_jobs WHERE id = $1) AND status = 'completed'`,
    [id]
  )

  const clientJobs = clientCountRes.rows[0]?.count || 0
  const provJobs = provCountRes.rows[0]?.count || 0

  const loyalty = calculateLoyaltyPricing({
    quotedPrice: Number(job.quoted_price),
    clientCompletedCount: clientJobs,
    providerCompletedCount: provJobs,
    standardCommissionRate: COMMISSION_RATE
  })

  return transition(
    id,
    ['negotiating'],
    'in_progress',
    `, payment_status = 'held_in_escrow', payment_method = $4, commission_amount = $5, quoted_price = $6`,
    [method, loyalty.commissionAmount, loyalty.finalClientPrice]
  )
}

// 6. MESTRE: terminou o trabalho
export async function finishWork(id: string) {
  return transition(id, ['in_progress'], 'awaiting_confirmation')
}

// 7. CLIENTE: confirma → liberta pagamento
export async function confirmAndRelease(id: string) {
  return transition(id, ['awaiting_confirmation'], 'completed', `, payment_status = 'released'`)
}

// CLIENTE: abre disputa → fica retido
export async function openDispute(id: string) {
  return transition(id, ['awaiting_confirmation'], 'in_progress')
}

export async function acceptRequest(id: string) {
  await db.query(`UPDATE service_requests SET status = 'accepted' WHERE id = $1`, [id])
}
export async function rejectRequest(id: string) {
  await db.query(`UPDATE service_requests SET status = 'cancelled' WHERE id = $1`, [id])
}

export async function clearOldPendingJobs() {
  const jobsRes = await db.query(`
    UPDATE service_jobs SET status = 'cancelled'
    WHERE status NOT IN ('completed', 'cancelled', 'rejected')
  `)
  const reqsRes = await db.query(`
    UPDATE service_requests SET status = 'cancelled'
    WHERE status = 'open'
  `)
  return {
    success: true,
    cancelledJobs: jobsRes.rowCount ?? 0,
    cancelledRequests: reqsRes.rowCount ?? 0
  }
}
