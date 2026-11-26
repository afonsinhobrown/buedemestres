'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

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

const REQUEST_MEDIA_BUCKET = 'request-media'

async function uploadRequestPhotos(requestId: string, files: File[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Storage não configurado')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: bucketError } = await supabase.storage.createBucket(REQUEST_MEDIA_BUCKET, { public: true })
  if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) {
    throw bucketError
  }

  for (const file of files.slice(0, 5)) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 8 * 1024 * 1024) throw new Error('Cada fotografia deve ter menos de 8 MB')

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${requestId}/${randomUUID()}-${safeName}`
    const { error } = await supabase.storage.from(REQUEST_MEDIA_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error

    const { data } = supabase.storage.from(REQUEST_MEDIA_BUCKET).getPublicUrl(path)
    await db.query('insert into request_media(request_id, url) values ($1, $2)', [requestId, data.publicUrl])
  }
}

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

    const requestId = rows[0].id as string
    const photos = formData.getAll('photos').filter((entry): entry is File => entry instanceof File)

    if (photos.length > 0) {
      try {
        await uploadRequestPhotos(requestId, photos)
      } catch (photoError) {
        console.error('Erro ao carregar fotografias:', photoError)
        await db.query('delete from service_requests where id = $1', [requestId])
        return { error: 'Não foi possível carregar as fotografias. Tenta novamente.' }
      }
    }

    revalidatePath('/pedidos')
    return { success: true, requestId }
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error)
    return { error: 'Ocorreu um erro interno ao processar o seu pedido.' }
  }
}
