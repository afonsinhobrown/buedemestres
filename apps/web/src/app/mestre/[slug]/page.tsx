import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import RequestServiceModal from '@/components/RequestServiceModal'
import HomeMap from '@/components/search/HomeMap'
import type { SearchMapProvider } from '@/components/search/SearchMap'

export const dynamic = 'force-dynamic'

type ProfileService = {
  id: string
  title: string
  description: string | null
  price_type: 'fixed' | 'hourly' | 'from' | 'quote'
  price_min: string | number | null
  price_max: string | number | null
  category_name: string | null
}

type ProfileReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string | Date
  client_name: string | null
}

function money(value: string | number | null): string | null {
  if (value == null) return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return `${new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 }).format(amount)} MT`
}

function servicePrice(service: ProfileService): string {
  const min = money(service.price_min)
  const max = money(service.price_max)
  if (service.price_type === 'quote' || (!min && !max)) return 'Sob orçamento'
  if (service.price_type === 'hourly') return `${min ?? max}/hora`
  if (service.price_type === 'from') return `A partir de ${min ?? max}`
  if (min && max && min !== max) return `${min} – ${max}`
  return min ?? max ?? 'Sob orçamento'
}

export default async function MasterProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const res = await db.query(`
    SELECT pp.*, d.name as district_name, p.name as province_name, c.name as category_name,
           coalesce(c.icon, '⚙') as category_icon, c.slug as category_slug
    FROM provider_profiles pp
    LEFT JOIN districts d ON pp.district_id = d.id
    LEFT JOIN provinces p ON d.province_id = p.id
    LEFT JOIN categories c ON pp.primary_category_id = c.id
    WHERE pp.slug = $1 AND pp.is_published = true
    LIMIT 1
  `, [slug])

  const row = (res.rows as any[])[0]
  if (!row) notFound()

  const servicesRes = await db.query(`
    SELECT ps.id, ps.title, ps.description, ps.price_type, ps.price_min, ps.price_max,
           c.name as category_name
    FROM provider_services ps
    LEFT JOIN categories c ON c.id = ps.category_id
    WHERE ps.provider_id = $1 AND ps.is_active = true
    ORDER BY ps.price_min ASC NULLS LAST, ps.title ASC
  `, [row.profile_id])
  const services = servicesRes.rows as ProfileService[]

  const reviewsRes = await db.query(`
    SELECT r.id, r.rating, r.comment, r.created_at, pr.name as client_name
    FROM reviews r
    LEFT JOIN profiles pr ON pr.id = r.client_id
    WHERE r.provider_id = $1 AND r.is_hidden = false
    ORDER BY r.created_at DESC
    LIMIT 10
  `, [row.profile_id])
  const reviews = reviewsRes.rows as ProfileReview[]

  const mapRow: SearchMapProvider | null = row.lat != null && row.lng != null
    ? {
        id: String(row.profile_id),
        slug: String(row.slug),
        name: String(row.business_name),
        headline: row.headline == null ? null : String(row.headline),
        categoryName: row.category_name == null ? null : String(row.category_name),
        categoryIcon: row.category_icon == null ? null : String(row.category_icon),
        categorySlug: row.category_slug == null ? null : String(row.category_slug),
        districtName: row.district_name == null ? null : String(row.district_name),
        rating: Number(row.rating_avg) || 0,
        ratingCount: Number(row.rating_count) || 0,
        verified: row.verification === 'approved',
        available: Boolean(row.is_available),
        featured: false,
        lat: Number(row.lat),
        lng: Number(row.lng),
        distanceKm: null,
        priceMin: services.reduce<number | null>((min, service) => {
          if (service.price_min == null) return min
          const value = Number(service.price_min)
          return Number.isFinite(value) && (min == null || value < min) ? value : min
        }, null),
      }
    : null

  return (
    <>
      <nav className="nav nav--flush">
        <div className="shell" style={{ display: 'flex', alignItems: 'center', gap: 26, width: '100%' }}>
          <Link href="/" className="placa pb sm" style={{ transform: 'none' }}>Bué de Mestres</Link>
          <Link href="/resultados">Voltar à pesquisa</Link>
          <Link href="/apps/cliente/entrar">Entrar (cliente)</Link>
          <Link href="/registar?redirect=/pro/activar" className="btn b1 s">Criar a minha placa</Link>
        </div>
      </nav>

      <main className="shell" style={{ paddingTop: 28, paddingBottom: 56 }}>
        <Link href="/resultados" className="btn b2 s">← Voltar</Link>

        <section className="master-hero">
          <div className={`placa ${row.color_class || 'pb'}`} style={{ transform: 'none', minWidth: 180 }}>
            {row.category_name || 'Mestre'}
          </div>
          <div>
            <h1 className="h1">{row.business_name}</h1>
            <p className="mut">{row.headline}</p>
            <p className="mut">{row.district_name || 'Maputo'} {row.province_name ? `· ${row.province_name}` : ''}</p>
            <div className="tags">
              <span>★ {Number(row.rating_avg || 0).toFixed(1)} ({row.rating_count || 0})</span>
              {row.verification === 'approved' && <span>Verificado</span>}
              {row.is_available && <span>Disponível agora</span>}
            </div>
          </div>
          <RequestServiceModal
            providerId={row.profile_id}
            providerName={row.business_name}
            defaultLat={row.lat}
            defaultLng={row.lng}
          />
        </section>

        <div className="master-extra">
          <section>
            <h2 className="h2 h2s h2s--flush">Sobre o Mestre</h2>
            <p className="mut">{row.bio || 'Este mestre ainda não escreveu a sua descrição.'}</p>
          </section>

          <section>
            <h2 className="h2 h2s h2s--flush">Serviços e preços</h2>
            {services.length === 0 ? (
              <p className="mut">Este mestre ainda não publicou serviços. Pede um orçamento.</p>
            ) : (
              <div className="service-list">
                {services.map((service) => (
                  <div className="service-row" key={service.id}>
                    <div>
                      <strong>{service.title}</strong>
                      {service.category_name && <span className="mut"> · {service.category_name}</span>}
                      {service.description && <p className="mut">{service.description}</p>}
                    </div>
                    <b>{servicePrice(service)}</b>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="h2 h2s h2s--flush">Avaliações</h2>
            {reviews.length === 0 ? (
              <p className="mut">Ainda sem avaliações publicadas.</p>
            ) : (
              <div className="review-list">
                {reviews.map((review) => (
                  <div className="review" key={review.id}>
                    <div className="review-top">
                      <span className="stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                      <span className="mut">{review.client_name || 'Cliente'}</span>
                      <span className="mut">
                        {new Date(review.created_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {review.comment && <p>{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="h2 h2s h2s--flush">Onde encontrar</h2>
            {mapRow ? (
              <HomeMap providers={[mapRow]} />
            ) : (
              <p className="mut">Este mestre ainda não partilhou a sua localização no mapa.</p>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
