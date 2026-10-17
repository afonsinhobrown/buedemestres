'use server'

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const STAFF_ROLES = ['support', 'moderator', 'finance', 'admin', 'superadmin'] as const
type StaffRole = (typeof STAFF_ROLES)[number]

async function requireSuperadmin() {
  const session = await verifySession()
  if (session.role !== 'superadmin') throw new Error('Sem permissão')
  return session
}

function normalizeRole(value: unknown): StaffRole | null {
  const role = String(value || '') as StaffRole
  return STAFF_ROLES.includes(role) ? role : null
}

export async function criarMembroEquipa(formData: FormData) {
  try {
    const session = await requireSuperadmin()

    const fullName = String(formData.get('full_name') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '')
    const role = normalizeRole(formData.get('staff_role'))

    if (!fullName || !email || !password || !role) {
      return { error: 'Preenche nome, e-mail, palavra-passe e papel.' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'E-mail inválido.' }
    }
    if (password.length < 8) {
      return { error: 'A palavra-passe deve ter pelo menos 8 caracteres.' }
    }

    const existing = await db.query('select id from profiles where lower(email) = $1', [email])
    if (existing.rows.length > 0) {
      return { error: 'Já existe uma conta com este e-mail.' }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await db.transaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into profiles(full_name, email, role, is_active)
         values ($1, $2, $3, true)
         returning id`,
        [fullName, email, role]
      )
      const profileId = rows[0].id

      await client.query(
        `insert into user_passwords(profile_id, password_hash) values ($1, $2)
         on conflict (profile_id) do update set password_hash = excluded.password_hash`,
        [profileId, passwordHash]
      )

      await client.query(
        `insert into wallets(profile_id) values ($1) on conflict (profile_id) do nothing`,
        [profileId]
      )

      await client.query(
        `insert into staff_profiles(profile_id, staff_role, must_change_password, mfa_required, is_active, created_by)
         values ($1, $2, false, false, true, $3)
         on conflict (profile_id) do update
           set staff_role = excluded.staff_role, is_active = true, created_by = excluded.created_by`,
        [profileId, role, session.userId]
      )

      await client.query(
        `insert into audit_logs(actor_id, action, entity, entity_id, meta)
         values ($1, 'create_staff_member', 'profiles', $2, $3::jsonb)`,
        [session.userId, profileId, JSON.stringify({ email, role })]
      )
    })

    revalidatePath('/superadmin/equipa')
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: error instanceof Error ? error.message : 'Erro ao criar membro da equipa.' }
  }
}

export async function alternarMembroEquipa(profileId: string, active: boolean) {
  try {
    const session = await requireSuperadmin()
    if (profileId === session.userId) return { error: 'Não podes suspender a tua própria conta.' }

    await db.transaction(async (client) => {
      await client.query('update staff_profiles set is_active = $2 where profile_id = $1', [profileId, active])
      await client.query('update profiles set is_active = $2, updated_at = now() where id = $1', [profileId, active])
      await client.query(
        `insert into audit_logs(actor_id, action, entity, entity_id, meta)
         values ($1, $2, 'profiles', $3, $4::jsonb)`,
        [session.userId, active ? 'activate_staff_member' : 'suspend_staff_member', profileId, JSON.stringify({ active })]
      )
    })

    revalidatePath('/superadmin/equipa')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao atualizar membro.' }
  }
}

export async function redefinirSenhaMembro(profileId: string, password: string) {
  try {
    const session = await requireSuperadmin()
    if (password.length < 8) return { error: 'A palavra-passe deve ter pelo menos 8 caracteres.' }

    const passwordHash = await bcrypt.hash(password, 12)
    await db.transaction(async (client) => {
      await client.query(
        `insert into user_passwords(profile_id, password_hash) values ($1, $2)
         on conflict (profile_id) do update set password_hash = excluded.password_hash`,
        [profileId, passwordHash]
      )
      await client.query(
        `update staff_profiles set must_change_password = true, password_changed_at = now() where profile_id = $1`,
        [profileId]
      )
      await client.query(
        `insert into audit_logs(actor_id, action, entity, entity_id, meta)
         values ($1, 'reset_staff_password', 'profiles', $2, '{}'::jsonb)`,
        [session.userId, profileId]
      )
    })

    revalidatePath('/superadmin/equipa')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao redefinir palavra-passe.' }
  }
}
