'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { updateSettings } from '@/lib/platform-settings'

async function requireAdmin() {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role || '')) {
    throw new Error('Sem permissão')
  }
  return session
}

async function requireSuperadmin() {
  const session = await verifySession()
  if (session.role !== 'superadmin') {
    throw new Error('Acesso restrito ao superadmin.')
  }
  return session
}

export async function updateTaxas(formData: FormData) {
  try {
    await requireSuperadmin()
    await updateSettings(formData)
    revalidatePath('/configuracoes')
    revalidatePath('/superadmin/financeiro')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao guardar as taxas.' }
  }
}

export async function updateSandbox(formData: FormData) {
  try {
    await requireAdmin()
    const active = String(formData.get('active') || '') === 'on'
    const min = Number(formData.get('min') || 11)
    const max = Number(formData.get('max') || 11)
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
    const priorityMode = String(formData.get('priority_mode') || 'none')
    const priorityStart = String(formData.get('priority_start') || '08:00')
    const priorityEnd = String(formData.get('priority_end') || '20:00')
    const weekend = String(formData.get('weekend_priority') || '') === 'on'
    const recurring = String(formData.get('recurring_visibility') || '') === 'on'
    const ratingBoost = Number(formData.get('rating_boost') || 0)

    if (!name) return { error: 'Nome do plano em falta.' }
    if (!['none', 'weekend', 'weekdays', 'always'].includes(priorityMode)) {
      return { error: 'Prioridade inválida.' }
    }

    await db.query(
      `update plans
          set name = $2, price = $3,
              priority_hours = jsonb_build_object('mode', $4::text, 'start', $5::text, 'end', $6::text),
              weekend_priority = $7, recurring_visibility = $8, rating_boost = $9
        where id = $1`,
      [id, name, price, priorityMode, priorityStart, priorityEnd, weekend, recurring, ratingBoost]
    )
    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao guardar plano.' }
  }
}
