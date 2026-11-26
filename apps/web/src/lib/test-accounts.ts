import 'server-only'
import { db } from '@/lib/db'

const TEST_PASSWORD_HASH = '$2b$12$fAxiksYq/wst9cWnvjtn7eV0z7DuwfT0BdB2SASWdPp8/I.OtsDw.'

const TEST_ACCOUNTS = new Set([
  'cliente@teste.com',
  'mecanico@teste.com',
])

export function isTestAccount(email: string): boolean {
  return TEST_ACCOUNTS.has(email.toLowerCase())
}

export async function ensureTestAccount(email: string): Promise<void> {
  const normalized = email.toLowerCase()
  if (!TEST_ACCOUNTS.has(normalized)) return

  const isProvider = normalized === 'mecanico@teste.com'
  const name = isProvider ? 'Mecânico Teste' : 'Cliente Teste'
  const role = isProvider ? 'provider' : 'client'

  await db.transaction(async (client) => {
    const { rows: categoryRows } = await client.query(
      `select id from categories where slug = 'mecanico' limit 1`
    )
    const { rows: districtRows } = await client.query(
      `select id from districts order by id limit 1`
    )
    const categoryId = categoryRows[0]?.id ?? null
    const districtId = districtRows[0]?.id ?? null

    const { rows: profileRows } = await client.query(
      `insert into profiles(full_name, email, role, district_id, is_active)
       values ($1, $2, $3, $4, true)
       on conflict (email) do update
         set role = excluded.role,
             is_active = true,
             updated_at = now()
       returning id`,
      [name, normalized, role, districtId]
    )
    const profileId = profileRows[0].id

    await client.query(
      `insert into wallets(profile_id) values ($1) on conflict (profile_id) do nothing`,
      [profileId]
    )

    await client.query(
      `insert into user_passwords(profile_id, password_hash)
       values ($1, $2)
       on conflict (profile_id) do update
         set password_hash = excluded.password_hash`,
      [profileId, TEST_PASSWORD_HASH]
    )

    if (!isProvider) return

    await client.query(
      `insert into provider_profiles(
         profile_id, slug, business_name, headline, bio, years_experience,
         primary_category_id, district_id, address, lat, lng, service_radius_km,
         verification, verified_at, is_available, is_published
       )
       values (
         $1, 'mecanico-teste', $2, 'Mecânico de automóveis em Maputo.',
         'Diagnóstico e reparação de automóveis.', 5,
         $3, $4, 'Maputo', -25.975000, 32.585000, 25,
         'approved', now(), true, true
       )
       on conflict (profile_id) do update
         set business_name = excluded.business_name,
             headline = excluded.headline,
             primary_category_id = excluded.primary_category_id,
             verification = 'approved',
             verified_at = coalesce(provider_profiles.verified_at, now()),
             is_available = true,
             is_published = true,
             updated_at = now()`,
      [profileId, name, categoryId, districtId]
    )

    if (categoryId == null) return

    await client.query(
      `insert into provider_categories(provider_id, category_id)
       values ($1, $2)
       on conflict (provider_id, category_id) do nothing`,
      [profileId, categoryId]
    )

    await client.query(
      `insert into provider_services(provider_id, category_id, title, price_min)
       select $1, $2, 'Diagnóstico e reparação de automóveis', 1500
       where not exists (
         select 1 from provider_services where provider_id = $1
       )`,
      [profileId, categoryId]
    )
  })
}
