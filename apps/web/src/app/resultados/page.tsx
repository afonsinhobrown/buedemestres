import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'
import { ads } from '@/lib/ads'
import SearchExperience, { type SearchCategory } from '@/components/search/SearchExperience'
import type { SearchMapProvider } from '@/components/search/SearchMap'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Encontrar mestres perto de ti — Bué de Mestres',
  description: 'Procura profissionais publicados no mapa, por categoria e localização.',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function ResultadosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = first(params.q).trim()
  const place = first(params.onde).trim()
  const categoryValue = Number(first(params.categoria))
  const selectedCategory = Number.isInteger(categoryValue) && categoryValue > 0 ? categoryValue : null

  let districtId: number | null = null
  if (place) {
    const districtResult = await db.query(
      'select id from districts where name ilike $1 order by length(name) limit 1',
      [`%${place}%`],
    )
    districtId = districtResult.rows[0]?.id ?? null
  }

  const categoryResult = await db.query(`
    select id, slug, name, coalesce(icon, '⚙') as icon
    from categories
    where is_active = true and parent_id is null
    order by sort_order, name
  `)
  const categories: SearchCategory[] = categoryResult.rows.map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    icon: String(row.icon),
  }))

  const result = await db.query(`
    select sp.profile_id::text as id,
           sp.slug,
           sp.business_name as name,
           pp.headline,
           sp.rating_avg::float8 as rating,
           sp.rating_count,
           sp.verified,
           sp.is_featured as featured,
           pp.is_available as available,
           pp.lat::float8 as lat,
           pp.lng::float8 as lng,
           coalesce(fc.slug, c.slug) as category_slug,
           coalesce(fc.name, c.name) as category_name,
           coalesce(fc.icon, c.icon, '⚙') as category_icon,
           d.name as district_name,
           (select min(ps.price_min) from provider_services ps
             where ps.provider_id = pp.profile_id and ps.is_active = true and ps.price_min is not null)::float8 as price_min
    from search_providers($1::text, $2::int, $3::int, null, 0, false, 60, 0) sp
    join provider_profiles pp on pp.profile_id = sp.profile_id
    left join categories c on c.id = pp.primary_category_id
    left join categories fc on fc.id = $2::int
    left join districts d on d.id = pp.district_id
    where pp.lat is not null and pp.lng is not null
    order by sp.rank desc, sp.rating_avg desc, pp.jobs_completed desc
  `, [query || null, selectedCategory, districtId])

  const providers: SearchMapProvider[] = result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    headline: row.headline == null ? null : String(row.headline),
    categoryName: row.category_name == null ? null : String(row.category_name),
    categoryIcon: row.category_icon == null ? null : String(row.category_icon),
    categorySlug: row.category_slug == null ? null : String(row.category_slug),
    districtName: row.district_name == null ? null : String(row.district_name),
    rating: Number(row.rating) || 0,
    ratingCount: Number(row.rating_count) || 0,
    verified: Boolean(row.verified),
    available: Boolean(row.available),
    featured: Boolean(row.featured),
    lat: Number(row.lat),
    lng: Number(row.lng),
    distanceKm: null,
    priceMin: row.price_min == null ? null : Number(row.price_min),
  }))

  const session = await getOptionalSession()
  const ad = ads[0]
  const adProp = ad
    ? { src: ad.src, alt: ad.alt, label: ad.label, width: ad.width, height: ad.height, href: ad.href }
    : null

  return (
    <SearchExperience
      providers={providers}
      categories={categories}
      query={query}
      place={place}
      selectedCategory={selectedCategory}
      signedIn={Boolean(session?.userId)}
      ad={adProp}
    />
  )
}
