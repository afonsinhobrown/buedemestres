'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const perfilSchema = z.object({
  business_name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  headline: z.string().optional(),
  bio: z.string().optional(),
  whatsapp: z.string().regex(/^\+258 8\d{1} \d{3} \d{4}$/, 'Formato inválido. Use +258 8X XXX XXXX').optional().or(z.literal('')),
  district_id: z.coerce.number().positive('Selecione um distrito'),
  years_experience: z.coerce.number().min(0, 'Anos de experiência inválidos').optional(),
})

export async function updateProviderProfile(formData: FormData) {
  const session = await verifySession()
  
  if (session.role !== 'provider' && session.role !== 'admin') {
    return { error: 'Sem permissão' }
  }

  const rawData = {
    business_name: formData.get('business_name'),
    headline: formData.get('headline'),
    bio: formData.get('bio'),
    whatsapp: formData.get('whatsapp'),
    district_id: formData.get('district_id'),
    years_experience: formData.get('years_experience'),
  }

  const result = perfilSchema.safeParse(rawData)

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const data = result.data

  try {
    // Tenta atualizar o perfil existente
    const updateResult = await db.query(`
      UPDATE provider_profiles 
      SET 
        business_name = $1,
        headline = $2,
        bio = $3,
        whatsapp = $4,
        district_id = $5,
        years_experience = $6
      WHERE profile_id = $7
      RETURNING profile_id
    `, [
      data.business_name,
      data.headline || null,
      data.bio || null,
      data.whatsapp || null,
      data.district_id,
      data.years_experience || null,
      session.userId
    ])

    if (updateResult.rowCount === 0) {
      // Se não existia, cria um novo (Upsert manual)
      const slug = data.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + session.userId.split('-')[0]
      
      await db.query(`
        INSERT INTO provider_profiles (
          profile_id, slug, business_name, headline, bio, whatsapp, district_id, years_experience
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        session.userId,
        slug,
        data.business_name,
        data.headline || null,
        data.bio || null,
        data.whatsapp || null,
        data.district_id,
        data.years_experience || null
      ])
    }

    // Atualiza também o distrito no perfil base
    await db.query(`UPDATE profiles SET district_id = $1 WHERE id = $2`, [data.district_id, session.userId])

    revalidatePath('/pro/perfil')
    return { success: true }
  } catch (error: any) {
    console.error(error)
    return { error: 'Ocorreu um erro ao guardar o perfil.' }
  }
}
