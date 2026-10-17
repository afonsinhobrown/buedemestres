'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const SEGMENTS = [
  'clientes_ativos',
  'clientes_inativos',
  'clientes_recorrentes',
  'mestres_ativos',
  'mestres_inativos',
] as const

type Segment = (typeof SEGMENTS)[number]

function segmentQuery(segment: Segment) {
  switch (segment) {
    case 'clientes_ativos':
      return `SELECT DISTINCT p.id FROM profiles p
              JOIN service_requests r ON r.client_id = p.id
              WHERE p.role = 'client' AND r.created_at >= NOW() - INTERVAL '30 days'`
    case 'clientes_inativos':
      return `SELECT p.id FROM profiles p
              WHERE p.role = 'client'
                AND NOT EXISTS (
                  SELECT 1 FROM service_requests r
                   WHERE r.client_id = p.id AND r.created_at >= NOW() - INTERVAL '30 days'
                )`
    case 'clientes_recorrentes':
      return `SELECT p.id FROM profiles p
              JOIN service_requests r ON r.client_id = p.id
              WHERE p.role = 'client'
              GROUP BY p.id
              HAVING COUNT(r.id) >= 2`
    case 'mestres_ativos':
      return `SELECT DISTINCT p.id FROM profiles p
              JOIN jobs j ON j.provider_id = p.id
              WHERE p.role = 'provider' AND j.status = 'completed'
                AND j.completed_at >= NOW() - INTERVAL '30 days'`
    case 'mestres_inativos':
      return `SELECT p.id FROM profiles p
              WHERE p.role = 'provider'
                AND NOT EXISTS (
                  SELECT 1 FROM jobs j
                   WHERE j.provider_id = p.id AND j.status = 'completed'
                     AND j.completed_at >= NOW() - INTERVAL '30 days'
                )`
  }
}

async function requireStaff() {
  const session = await verifySession()
  if (!['superadmin', 'admin'].includes(session.role || '')) throw new Error('Sem permissão')
  return session
}

export async function contarSegmentos() {
  await requireStaff()
  const result: Record<string, number> = {}
  for (const segment of SEGMENTS) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM (${segmentQuery(segment)}) q`)
    result[segment] = rows[0]?.total || 0
  }
  return result
}

export async function enviarPromocao(formData: FormData) {
  try {
    const session = await requireStaff()

    const segment = String(formData.get('segment') || '') as Segment
    const title = String(formData.get('title') || '').trim()
    const body = String(formData.get('body') || '').trim()
    const promoCode = String(formData.get('promo_code') || '').trim().toUpperCase()
    const discount = Number(formData.get('discount_pct') || 0)

    if (!SEGMENTS.includes(segment)) return { error: 'Segmento inválido.' }
    if (!title || !body) return { error: 'Preenche o título e a mensagem.' }
    if (promoCode && (!Number.isFinite(discount) || discount <= 0 || discount > 100)) {
      return { error: 'Indica uma percentagem de desconto entre 1 e 100.' }
    }

    const meta = JSON.stringify({
      segment,
      promo_code: promoCode || null,
      discount_pct: promoCode ? discount : null,
    })

    const { rows } = await db.query<{ total: string }>(
      `WITH destinatarios AS (${segmentQuery(segment)}),
            inseridos AS (
              INSERT INTO notifications(profile_id, type, title, body, data)
              SELECT id, 'promocao', $1, $2, $3::jsonb FROM destinatarios
              RETURNING id
            )
       SELECT COUNT(*)::text AS total FROM inseridos`,
      [title, body, meta]
    )

    const total = Number(rows[0]?.total || 0)

    await db.query(
      `INSERT INTO audit_logs(actor_id, action, entity, meta)
       VALUES ($1, 'send_promotion', 'notifications', $2::jsonb)`,
      [session.userId, JSON.stringify({ segment, title, promo_code: promoCode || null, discount_pct: promoCode ? discount : null, total })]
    )

    revalidatePath('/superadmin/promocoes')
    return { success: true, total }
  } catch (error) {
    console.error(error)
    return { error: error instanceof Error ? error.message : 'Erro ao enviar promoção.' }
  }
}
