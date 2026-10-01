'use server'

import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const createRequestSchema = z.object({
  categoryId: z.coerce.number().int().positive('Selecione uma categoria'),
  title: z.string().min(5, 'Título muito curto').max(100, 'Título muito longo'),
  description: z.string().min(10, 'Descreva melhor o problema (mínimo 10 caracteres)'),
  districtId: z.coerce.number().int().positive('Selecione um distrito/bairro').optional(),
  address: z.string().optional(),
  preferredDate: z.string().optional(),
  budgetMin: z.coerce.number().min(0).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  targetProviderId: z.string().uuid().optional(),
})

export async function createRequest(prevState: any, formData: FormData) {
  const session = await verifySession()
  if (!session?.userId) {
    return { error: 'Não autenticado' }
  }

  const rawData = Object.fromEntries(formData.entries())
  
  // Tratar os opcionais vazios
  if (!rawData.budgetMin) delete rawData.budgetMin
  if (!rawData.budgetMax) delete rawData.budgetMax
  if (!rawData.preferredDate) delete rawData.preferredDate
  if (!rawData.districtId) delete rawData.districtId
  if (!rawData.targetProviderId) delete rawData.targetProviderId

  const result = createRequestSchema.safeParse(rawData)

  if (!result.success) {
    return { fieldErrors: result.error.flatten().fieldErrors }
  }

  const data = result.data

  try {
    const { rows } = await db.query(
      `INSERT INTO service_requests (
        client_id, category_id, title, description, district_id, address, 
        preferred_date, budget_min, budget_max, target_provider_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        session.userId,
        data.categoryId,
        data.title,
        data.description,
        data.districtId || null,
        data.address || null,
        data.preferredDate || null,
        data.budgetMin || null,
        data.budgetMax || null,
        data.targetProviderId || null
      ]
    )

    if (rows.length === 0) {
      return { error: 'Falha ao criar pedido' }
    }

    revalidatePath('/pedidos')
    return { success: true, requestId: rows[0].id }
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error)
    return { error: 'Ocorreu um erro interno ao processar o seu pedido.' }
  }
}
