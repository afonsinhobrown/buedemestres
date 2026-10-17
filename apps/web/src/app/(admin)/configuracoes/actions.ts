'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role || '')) {
    throw new Error('Sem permissão')
  }
  return session
}

export async function updateSandbox(formData: FormData) {
  try {
    await requireAdmin()
    const active = String(formData.get('active') || '') === 'on'
    const min = Number(formData.get('min') || 1)
    const max = Math.min(Number(formData.get('max') || 10), 10)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      return { error: 'Valores de sandbox inválidos.' }
    }
    await db.transaction(async (client) => {
      for (const [key, value] of [
        ['sandbox_mode', JSON.stringify(active)],
        ['sandbox_min_price', JSON.stringify(min)],
        ['sandbox_max_price', JSON.stringify(max)],
      ]) {
        await client.query(
          `insert into app_settings(key, value, updated_at) values ($1, $2::jsonb, now())
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
          [key, value]
        )
      }
    })
    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao guardar.' }
  }
}

export async function updatePlan(formData: FormData) {
  try {
    await requireAdmin()
    const id = Number(formData.get('id'))
    if (!Number.isFinite(id)) return { error: 'Plano inválido.' }

    const name = String(formData.get('name') || '').trim()
    const price = Number(formData.get('price') || 0)
    const maxServices = Number(formData.get('max_services') || 0)
    const maxPhotos = Number(formData.get('max_photos') || 0)
    const weekend = String(formData.get('weekend_priority') || '') === 'on'
    const recurring = String(formData.get('recurring_visibility') || '') === 'on'
    const ratingBoost = Number(formData.get('rating_boost') || 0)
    const creditPrice = Number(formData.get('credit_price') || 0)
    const maxMasters = Number(formData.get('max_masters') || 1)

    if (!name) return { error: 'Nome do plano em falta.' }

    await db.query(
      `update plans
          set name = $2, price = $3, max_services = $4, max_photos = $5,
              weekend_priority = $6, recurring_visibility = $7, rating_boost = $8,
              credit_price = $9, max_masters = $10
        where id = $1`,
      [id, name, price, maxServices, maxPhotos, weekend, recurring, ratingBoost, creditPrice, maxMasters]
    )
    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao guardar plano.' }
  }
}
