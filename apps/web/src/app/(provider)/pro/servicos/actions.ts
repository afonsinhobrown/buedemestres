'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const serviceSchema = z.object({
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres'),
  category_id: z.coerce.number().positive('Selecione uma categoria'),
  description: z.string().optional(),
  price_type: z.enum(['fixed', 'hourly', 'from', 'quote']),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  is_active: z.boolean().default(true),
})

export async function createService(formData: FormData) {
  const session = await verifySession()
  if (session.role !== 'provider' && session.role !== 'admin') return { error: 'Sem permissão' }

  const data = {
    title: formData.get('title'),
    category_id: formData.get('category_id'),
    description: formData.get('description'),
    price_type: formData.get('price_type'),
    price_min: formData.get('price_min') || undefined,
    price_max: formData.get('price_max') || undefined,
    is_active: formData.get('is_active') === 'true',
  }

  const result = serviceSchema.safeParse(data)
  if (!result.success) return { error: result.error.errors[0].message }

  try {
    await db.query(`
      INSERT INTO provider_services (
        provider_id, category_id, title, description, price_type, price_min, price_max, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      session.userId,
      result.data.category_id,
      result.data.title,
      result.data.description || null,
      result.data.price_type,
      result.data.price_min || null,
      result.data.price_max || null,
      result.data.is_active
    ])

    revalidatePath('/pro/servicos')
    return { success: true }
  } catch (err: any) {
    console.error(err)
    return { error: 'Erro ao criar o serviço.' }
  }
}

export async function deleteService(id: string) {
  const session = await verifySession()
  if (session.role !== 'provider' && session.role !== 'admin') return { error: 'Sem permissão' }

  try {
    await db.query(`DELETE FROM provider_services WHERE id = $1 AND provider_id = $2`, [id, session.userId])
    revalidatePath('/pro/servicos')
    return { success: true }
  } catch (err: any) {
    return { error: 'Erro ao apagar o serviço.' }
  }
}

export async function toggleServiceActive(id: string, is_active: boolean) {
  const session = await verifySession()
  if (session.role !== 'provider' && session.role !== 'admin') return { error: 'Sem permissão' }

  try {
    await db.query(`UPDATE provider_services SET is_active = $1 WHERE id = $2 AND provider_id = $3`, [is_active, id, session.userId])
    revalidatePath('/pro/servicos')
    return { success: true }
  } catch (err: any) {
    return { error: 'Erro ao atualizar o serviço.' }
  }
}
