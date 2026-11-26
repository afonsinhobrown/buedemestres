import 'server-only'
import { db } from '@/lib/db'
import {
  buildCategoryTree,
  findCategoryBySlug,
  type CategoryNode,
  type CategoryRow,
  type DiscoveryDistrict,
  type DiscoveryProvider,
} from '@/lib/discovery'

type ProviderRow = {
  profile_id: string
  slug: string
  business_name: string
  headline: string | null
  rating_avg: number
  rating_count: number
  verified: boolean
  available: boolean
  featured: boolean
  lat: number | null
  lng: number | null
  category_id: number
  category_name: string
  category_icon: string
  district_name: string | null
  province_name: string | null
  jobs_completed: number
}

export type DiscoveryStats = {
  total: number
  verified: number
  available: number
}

export type DiscoveryData = {
  categories: CategoryNode[]
  providers: DiscoveryProvider[]
  districts: DiscoveryDistrict[]
  stats: DiscoveryStats
  selectedCategorySlug: string
  selectedDistrictId: number | null
  selectedDistrictName: string | null
  hasFilters: boolean
  loadError: boolean
}

export async function loadDiscoveryData(options: {
  q?: string
  categoryValue?: string
  districtId?: number | null
  verifiedOnly?: boolean
  availableOnly?: boolean
}): Promise<DiscoveryData> {
  const q = options.q?.trim() ?? ''
  const categoryValue = options.categoryValue?.trim() ?? ''
  const districtId = options.districtId ?? null
  const verifiedOnly = options.verifiedOnly ?? false
  const availableOnly = options.availableOnly ?? false

  let categories: CategoryNode[] = []
  let providers: DiscoveryProvider[] = []
  let districts: DiscoveryDistrict[] = []
  let stats: DiscoveryStats = { total: 0, verified: 0, available: 0 }
  let loadError = false

  try {
    const [categoryRows, districtRows, statsRows] = await Promise.all([
      db.query<CategoryRow>(`
        select c.id, c.slug, c.name, c.icon, c.parent_id,
               (
                 select count(*)::int
                   from provider_profiles pp
                  where pp.is_published
                    and pp.primary_category_id = c.id
               ) as provider_count
          from categories c
         where c.is_active
         order by c.parent_id nulls first, c.sort_order, c.name
      `),
      db.query<DiscoveryDistrict>(`
        select d.id, d.name, p.name as province
          from districts d
          join provinces p on p.id = d.province_id
         order by p.name, d.name
      `),
      db.query<DiscoveryStats>(`
        select count(*)::int as total,
               count(*) filter (where verification = 'approved')::int as verified,
               count(*) filter (where is_available)::int as available
          from provider_profiles
         where is_published
      `),
    ])

    categories = buildCategoryTree(categoryRows.rows)
    districts = districtRows.rows
    stats = statsRows.rows[0] ?? stats

    const selected = findCategoryBySlug(categories, categoryValue)
    const selectedCategoryId = selected?.category.id ?? null

    const providerRows = await db.query<ProviderRow>(
      `
        select pp.profile_id,
               pp.slug,
               pp.business_name,
               pp.headline,
               pp.rating_avg::float8 as rating_avg,
               pp.rating_count,
               (pp.verification = 'approved') as verified,
               pp.is_available as available,
               exists (
                 select 1
                   from boosts b
                  where b.provider_id = pp.profile_id
                    and b.type = 'featured'
                    and b.ends_at > now()
                    and (b.category_id is null or b.category_id = $2::int)
               ) as featured,
               pp.lat::float8 as lat,
               pp.lng::float8 as lng,
               c.id as category_id,
               c.name as category_name,
               coalesce(c.icon, parent.icon, '🛠️') as category_icon,
               d.name as district_name,
               p.name as province_name,
               pp.jobs_completed
          from provider_profiles pp
          join categories c on c.id = pp.primary_category_id
          left join categories parent on parent.id = c.parent_id
          left join districts d on d.id = pp.district_id
          left join provinces p on p.id = d.province_id
         where pp.is_published
           and (
             $1 = ''
             or pp.search_document @@ websearch_to_tsquery('portuguese', unaccent($1))
             or pp.business_name ilike '%' || $1 || '%'
             or coalesce(pp.headline, '') ilike '%' || $1 || '%'
             or c.name ilike '%' || $1 || '%'
           )
           and ($2::int is null or pp.primary_category_id = $2::int or c.parent_id = $2::int)
           and ($3::int is null or pp.district_id = $3::int)
           and (not $4::boolean or pp.verification = 'approved')
           and (not $5::boolean or pp.is_available)
         order by featured desc, pp.rating_avg desc, pp.jobs_completed desc, pp.business_name
         limit 60
      `,
      [q, selectedCategoryId, districtId, verifiedOnly, availableOnly]
    )

    providers = providerRows.rows.map((row) => ({
      profileId: row.profile_id,
      slug: row.slug,
      businessName: row.business_name,
      headline: row.headline,
      ratingAvg: Number(row.rating_avg ?? 0),
      ratingCount: Number(row.rating_count ?? 0),
      verified: Boolean(row.verified),
      available: Boolean(row.available),
      featured: Boolean(row.featured),
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryIcon: row.category_icon || '🛠️',
      districtName: row.district_name,
      provinceName: row.province_name,
      jobsCompleted: Number(row.jobs_completed ?? 0),
    }))
  } catch (error) {
    console.error('[discovery] falha ao carregar dados:', error)
    loadError = true
  }

  const selected = findCategoryBySlug(categories, categoryValue)
  const selectedDistrict = districtId
    ? districts.find((district) => district.id === districtId) ?? null
    : null

  return {
    categories,
    providers,
    districts,
    stats,
    selectedCategorySlug: selected?.category.slug ?? '',
    selectedDistrictId: districtId,
    selectedDistrictName: selectedDistrict?.name ?? null,
    hasFilters: Boolean(q || selected || districtId || verifiedOnly || availableOnly),
    loadError,
  }
}
