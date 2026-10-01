'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import {
  RegisterSchema,
  LoginSchema,
  UpdateProfileSchema,
  ActivateProviderSchema,
  type ActionState,
} from '@/lib/validators/auth'
import { createSession, deleteSession, verifySession } from '@/lib/session'
import type { Profile } from '@/types/database'
import { slugify } from '@/lib/utils/slug'

// ─────────────────────────────────────────────
// REGISTO
// ─────────────────────────────────────────────
export async function registerAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    referral_code: formData.get('referral_code') ?? '',
  }

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      message: 'Dados inválidos.',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { full_name, email, password, referral_code } = parsed.data

  // Verificar e-mail único
  const existing = await db.query(
    'select id from profiles where email = $1',
    [email]
  )
  if (existing.rows.length > 0) {
    return {
      success: false,
      message: 'Este e-mail já está registado.',
      errors: { email: ['Este e-mail já está registado.'] },
    }
  }

  const password_hash = await bcrypt.hash(password, 12)

  // Inserir perfil + carteira + referral numa transacção
  const result = await db.transaction(async (client) => {
    // Inserir perfil com password_hash numa coluna extra
    const { rows } = await client.query<Profile>(
      `insert into profiles (full_name, email, role)
       values ($1, $2, 'client') returning id, role`,
      [full_name, email]
    )
    const profile = rows[0]

    // Guardar password_hash em tabela separada
    await client.query(
      `insert into user_passwords (profile_id, password_hash) values ($1, $2)`,
      [profile.id, password_hash]
    )

    // Carteira criada automaticamente pelo trigger — garantir se não existir
    await client.query(
      `insert into wallets (profile_id) values ($1) on conflict do nothing`,
      [profile.id]
    )

    // Afiliado
    if (referral_code) {
      const ref = await client.query(
        `select id from profiles where referral_code = $1`,
        [referral_code.toUpperCase()]
      )
      if (ref.rows.length > 0 && ref.rows[0].id !== profile.id) {
        await client.query(
          `update profiles set referred_by = $1 where id = $2`,
          [ref.rows[0].id, profile.id]
        )
        await client.query(
          `insert into referrals (referrer_id, referred_id) values ($1, $2) on conflict do nothing`,
          [ref.rows[0].id, profile.id]
        )
      }
    }

    return profile
  })

  await createSession(result.id, result.role)
  redirect('/painel')
}

// ─────────────────────────────────────────────
// ENTRAR
// ─────────────────────────────────────────────
export async function loginAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      message: 'Dados inválidos.',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { email, password } = parsed.data

  const { rows } = await db.query<{ id: string; role: Profile['role']; password_hash: string; is_active: boolean }>(
    `select p.id, p.role, p.is_active, up.password_hash
     from profiles p
     join user_passwords up on up.profile_id = p.id
     where p.email = $1`,
    [email]
  )

  if (rows.length === 0) {
    return { success: false, message: 'E-mail ou palavra-passe incorrectos.' }
  }

  const user = rows[0]

  if (!user.is_active) {
    return { success: false, message: 'Conta suspensa. Contacte o suporte.' }
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    return { success: false, message: 'E-mail ou palavra-passe incorrectos.' }
  }

  await createSession(user.id, user.role)
  redirect('/painel')
}

// ─────────────────────────────────────────────
// SAIR
// ─────────────────────────────────────────────
export async function logoutAction(): Promise<void> {
  await deleteSession()
  redirect('/entrar')
}

// ─────────────────────────────────────────────
// ACTUALIZAR PERFIL
// ─────────────────────────────────────────────
export async function updateProfileAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const session = await verifySession()

  const raw = {
    full_name: formData.get('full_name') ?? undefined,
    phone: formData.get('phone') ?? undefined,
    district_id: formData.get('district_id')
      ? Number(formData.get('district_id'))
      : undefined,
  }

  const parsed = UpdateProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      message: 'Dados inválidos.',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { full_name, phone, district_id } = parsed.data

  await db.query(
    `update profiles set
       full_name   = coalesce($1, full_name),
       phone       = coalesce($2, phone),
       district_id = coalesce($3, district_id)
     where id = $4`,
    [full_name ?? null, phone ?? null, district_id ?? null, session.userId]
  )

  return { success: true, message: 'Perfil actualizado com sucesso.' }
}

// ─────────────────────────────────────────────
// ACTIVAR PERFIL PROFISSIONAL
// ─────────────────────────────────────────────
export async function activateProviderAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const session = await verifySession()

  const raw = {
    business_name: formData.get('business_name'),
    primary_category_id: Number(formData.get('primary_category_id')),
    district_id: Number(formData.get('district_id')),
    phone: formData.get('phone'),
  }

  const parsed = ActivateProviderSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      message: 'Dados inválidos.',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { business_name, primary_category_id, district_id, phone } = parsed.data

  // Gerar slug único
  const baseSlug = slugify(business_name)
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { rows } = await db.query(
      'select 1 from provider_profiles where slug = $1',
      [slug]
    )
    if (rows.length === 0) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  await db.transaction(async (client) => {
    // Garantir que o telefone está no perfil
    await client.query(
      `update profiles set phone = $1, role = 'provider' where id = $2`,
      [phone, session.userId]
    )

    await client.query(
      `insert into provider_profiles
         (profile_id, slug, business_name, primary_category_id, district_id)
       values ($1, $2, $3, $4, $5)
       on conflict (profile_id) do nothing`,
      [session.userId, slug, business_name, primary_category_id, district_id]
    )

    await client.query(
      `insert into provider_categories (provider_id, category_id)
       values ($1, $2) on conflict do nothing`,
      [session.userId, primary_category_id]
    )
  })

  redirect('/pro/perfil')
}
