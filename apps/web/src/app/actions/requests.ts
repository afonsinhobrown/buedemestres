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
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
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
  const photos = formData.getAll('photos').filter((entry): entry is File => entry instanceof File)

  if (photos.length > 0 && String(rawData.description || '').trim().length < 10) {
    rawData.description = 'Pedido com fotografias do problema.'
  }

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

    if (data.lat != null && data.lng != null) {
      try {
        await db.query(
          `update service_requests
              set location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            where id = $3`,
          [data.lng, data.lat, requestId]
        )
      } catch (locationError) {
        console.warn('Localização não guardada:', locationError)
      }
    }

    if (photos.length > 0) {
      try {
        await uploadRequestPhotos(requestId, photos)
      } catch (photoError) {
        console.error('Erro ao carregar fotografias:', photoError)
        await db.query('delete from service_requests where id = $1', [requestId])
        return { error: 'Não foi possível carregar as fotografias. Tenta novamente.' }
      }
    }

    try {
      let providerIds: string[] = []
      if (data.targetProviderId) {
        providerIds = [data.targetProviderId]
      } else {
        const providerRows = await db.query<{ profile_id: string }>(
          `select distinct pp.profile_id
             from provider_profiles pp
            where pp.is_published = true
              and (
                pp.primary_category_id = $1
                or exists (
                  select 1 from provider_categories pc
                   where pc.provider_id = pp.profile_id and pc.category_id = $1
                )
              )
            limit 100`,
          [data.categoryId]
        )
        providerIds = providerRows.rows.map((row) => row.profile_id)
      }

      if (providerIds.length > 0) {
        await db.query(
          `insert into notifications(profile_id, type, title, body, data)
           select unnest($1::uuid[]), 'new_request', 'Novo pedido disponível', $2, $3::jsonb`,
          [
            providerIds,
            `${data.title} — vê os detalhes e envia o teu orçamento.`,
            JSON.stringify({ requestId, categoryId: data.categoryId }),
          ]
        )
      }

      await db.query(
        `insert into notifications(profile_id, type, title, body, data)
         values ($1, 'request_published', 'Pedido publicado', $2, $3::jsonb)`,
        [
          session.userId,
          'O teu pedido foi publicado. Aguarda a resposta dos mestres.',
          JSON.stringify({ requestId }),
        ]
      )
    } catch (notificationError) {
      console.warn('Notificações do pedido não enviadas:', notificationError)
    }

    revalidatePath('/pedidos')
    revalidatePath('/notificacoes')
    return { success: true, requestId }
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error)
    return { error: 'Ocorreu um erro interno ao processar o seu pedido.' }
  }
}
