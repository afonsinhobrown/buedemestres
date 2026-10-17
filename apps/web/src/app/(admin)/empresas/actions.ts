'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function setCompanyVerification(companyId: string, status: 'approved' | 'rejected' | 'pending') {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role || '')) return { error: 'Sem permissão' }

  try {
    await db.transaction(async (client) => {
      const { rows } = await client.query<{ owner_id: string; trade_name: string }>(
        `update companies
            set verification = $2,
                status = case when $2 = 'approved' then 'approved' when $2 = 'rejected' then 'rejected' else status end,
                updated_at = now()
          where id = $1
          returning owner_id, trade_name`,
        [companyId, status]
      )
      const company = rows[0]
      if (!company) throw new Error('Empresa não encontrada')

      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values ($1, 'company_verification', $2, $3, $4::jsonb)`,
        [
          company.owner_id,
          status === 'approved' ? 'Empresa aprovada' : status === 'rejected' ? 'Empresa rejeitada' : 'Verificação pendente',
          status === 'approved'
            ? 'Os documentos da empresa foram aprovados. Já podes operar com os mestres associados.'
            : status === 'rejected'
            ? 'Os documentos da empresa foram rejeitados. Corrige e submete novamente.'
            : 'A verificação da empresa voltou a pendente.',
          JSON.stringify({ company_id: companyId, status }),
        ]
      )

      if (status === 'approved') {
        await client.query(
          `update provider_profiles set verification = 'approved'
            where profile_id in (select provider_id from company_masters where company_id = $1)`,
          [companyId]
        )
      }
    })
    revalidatePath('/empresas')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao atualizar empresa.' }
  }
}
