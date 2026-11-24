'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchMapPosition, SearchMapProvider } from './SearchMap'
import { formatMT } from '@/lib/utils/format-mzn'
import { haversineKm, sortSearchProviders, type SearchSort } from '@/lib/search-map'

const SearchMap = dynamic(() => import('./SearchMap'), {
  ssr: false,
  loading: () => <div className="bdm-map-loading">A carregar mapa…</div>,
})

export type SearchCategory = {
  id: number
  slug: string
  name: string
  icon: string
}

type SearchExperienceProps = {
  providers: SearchMapProvider[]
  categories: SearchCategory[]
  query: string
  place: string
  selectedCategory: number | null
  signedIn: boolean
  ad: { src: string; alt: string; label: string; width: number; height: number; href?: string } | null
}

const sortOptions: { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'rating', label: 'Avaliação' },
  { value: 'distance', label: 'Mais perto' },
  { value: 'price', label: 'Preço' },
]

function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

export default function SearchExperience({
  providers,
  categories,
  query,
  place,
  selectedCategory,
  signedIn,
  ad,
}: SearchExperienceProps) {
  const [sort, setSort] = useState<SearchSort>('relevance')
  const [userPosition, setUserPosition] = useState<SearchMapPosition | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const pathname = usePathname()
  const basePath = pathname === '/' ? '/' : '/resultados'

  const visibleProviders = useMemo(
    () => sortSearchProviders(providers, sort, userPosition),
    [providers, sort, userPosition],
  )

  const enrichedProviders = useMemo<SearchMapProvider[]>(
    () =>
      visibleProviders.map((provider) => ({
        ...provider,
        distanceKm: userPosition
          ? haversineKm(userPosition, [provider.lat, provider.lng])
          : provider.distanceKm,
      })),
    [visibleProviders, userPosition],
  )

  useEffect(() => {
    if (!selectedId) return
    cardRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedId])

  const buildHref = (categoryId: number | null) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (place) params.set('onde', place)
    if (categoryId && categoryId > 0) params.set('categoria', String(categoryId))
    const suffix = params.toString()
    return `${basePath}${suffix ? `?${suffix}` : ''}`
  }

  const activeCategory = categories.find((category) => category.id === selectedCategory)
  const resultLabel = `${providers.length} ${providers.length === 1 ? 'encontrado' : 'encontrados'}`

  return (
    <div className="bdm-map-page">
      <header className="bdm-topbar">
        <Link href="/" className="bdm-brand" aria-label="Bué de Mestres — início">
          <span className="bdm-brand-mark">🛠</span>
          <span className="bdm-brand-name">
            Bué de Mestres
            <small>O serviço certo, perto de si.</small>
          </span>
        </Link>
        <div className="bdm-top-actions">
          <span className="bdm-location-top">📍 {place || 'Todo o país'}</span>
          <Link href="/como-funciona" className="bdm-top-link bdm-top-link--optional">Como funciona</Link>
          <Link href="/registar?redirect=/pro/activar" className="bdm-top-link">Para mestres</Link>
          <Link href="/ajuda" className="bdm-top-link">Ajuda</Link>
          <Link href={signedIn ? '/painel' : '/entrar'} className="bdm-top-link">{signedIn ? 'Painel' : 'Entrar'}</Link>
          <Link href="/registar" className="bdm-top-cta">Criar conta</Link>
        </div>
      </header>

      <nav className="bdm-mobile-nav" aria-label="Serviços">
        <Link href="/">Mapa</Link>
        <Link href="/chamar">Chamar agora</Link>
        <Link href={signedIn ? '/trabalhos' : '/entrar'}>Trabalhos</Link>
        <Link href={signedIn ? '/pedidos' : '/entrar'}>Pedidos</Link>
        <Link href="/notificacoes">Notificações</Link>
        <Link href="/pro/trabalhos">Área do mestre</Link>
        <Link href="/ajuda">Ajuda</Link>
        <Link href="/como-funciona">Como funciona</Link>
      </nav>

      <main className="bdm-app">
        <aside className="bdm-panel bdm-left-panel">
          <div className="bdm-panel-heading">
            <span>☷ Categorias</span>
            <span>⌄</span>
          </div>
          <nav className="bdm-category-list" aria-label="Categorias de serviço">
            <Link
              href={buildHref(null)}
              className={`bdm-category ${selectedCategory ? '' : 'is-active'}`}
            >
              <span className="bdm-ico">⌕</span>
              Todos os serviços
              <span className="bdm-chev">›</span>
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={buildHref(category.id)}
                className={`bdm-category ${selectedCategory === category.id ? 'is-active' : ''}`}
              >
                <span className="bdm-ico">{category.icon}</span>
                {category.name}
                <span className="bdm-chev">›</span>
              </Link>
            ))}
          </nav>
          <div className="bdm-category-footer">
            <div className="bdm-small-note">
              Escolhe uma especialidade para veres os profissionais publicados no mapa.
            </div>
            <div className="bdm-mini-links">
              <Link href="/chamar">Chamar agora</Link>
              <Link href={signedIn ? '/trabalhos' : '/entrar'}>Os meus trabalhos</Link>
              <Link href={signedIn ? '/pedidos' : '/entrar'}>Os meus pedidos</Link>
              <Link href="/notificacoes">Notificações</Link>
              <Link href="/pro/trabalhos">Área do mestre</Link>
              <Link href="/como-funciona">Como funciona</Link>
              <Link href="/ajuda">Ajuda</Link>
            </div>
          </div>
        </aside>

        <section className="bdm-center">
          <div className="bdm-map-shell">
            <SearchMap
              providers={enrichedProviders}
              selectedId={selectedId}
              onSelect={setSelectedId}
              userPosition={userPosition}
              onPosition={setUserPosition}
            />
            <form className="bdm-map-search" action={basePath} method="GET">
              <span className="bdm-search-icon">⌕</span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Ex.: mecânico, canalizador, electricista…"
                aria-label="Pesquisar serviços"
              />
              <input name="onde" defaultValue={place} className="bdm-hidden-place" aria-hidden="true" tabIndex={-1} readOnly />
              {selectedCategory ? (
                <input type="hidden" name="categoria" value={selectedCategory} />
              ) : null}
              <button type="submit" className="bdm-search-btn">Pesquisar</button>
            </form>
            <div className="bdm-map-status">
              <span className="bdm-green-dot" />
              {providers.length} {providers.length === 1 ? 'profissional no mapa' : 'profissionais no mapa'}
            </div>
            <div className="bdm-map-legend">
              {categories.slice(0, 3).map((category) => (
                <span key={category.id} className="bdm-legend-item">
                  <i className={`bdm-legend-dot bdm-legend-dot--${category.slug.includes('electric') ? 'yellow' : category.slug.includes('canaliz') ? 'green' : 'blue'}`} />
                  {category.name}
                </span>
              ))}
            </div>
          </div>

          <section className="bdm-results" aria-label="Resultados da pesquisa">
            <div className="bdm-results-head">
              <div>
                <span className="bdm-results-title">
                  {activeCategory ? `Mestres de ${activeCategory.name}` : 'Mestres disponíveis perto de ti'}
                </span>
                <span className="bdm-results-count">{resultLabel}</span>
              </div>
              <div className="bdm-sort">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={sort === option.value ? 'is-active' : ''}
                    onClick={() => setSort(option.value)}
                    disabled={option.value === 'distance' && !userPosition}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bdm-result-list">
              {enrichedProviders.map((provider) => (
                <article
                  key={provider.id}
                  ref={(node) => {
                    cardRefs.current[provider.id] = node
                  }}
                  role="button"
                  tabIndex={0}
                  className={`bdm-master-card ${selectedId === provider.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(provider.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(provider.id)
                    }
                  }}
                >
                  <span className="bdm-master-icon">{provider.categoryIcon || '⚙'}</span>
                  <span className="bdm-master-info">
                    <strong>{provider.name}</strong>
                    <span>
                      {provider.categoryName || 'Serviço'}
                      {provider.districtName ? ` · ${provider.districtName}` : ''}
                    </span>
                    {provider.headline && <span className="bdm-master-headline">{provider.headline}</span>}
                    <span className={`bdm-availability ${provider.available ? 'is-available' : ''}`}>
                      ● {provider.available ? 'Disponível agora' : 'Indisponível'}
                      {provider.verified ? ' · Verificado' : ''}
                    </span>
                  </span>
                  <span className="bdm-master-meta">
                    <b>★ {provider.rating.toFixed(1)}</b>
                    <span>{provider.ratingCount} avaliações</span>
                    {provider.distanceKm != null && <span>{formatDistance(provider.distanceKm)}</span>}
                    {provider.priceMin != null && <span>{formatMT(provider.priceMin)}</span>}
                    <Link href={`/mestre/${provider.slug}`} className="bdm-card-link" onClick={(event) => event.stopPropagation()}>
                      Ver perfil
                    </Link>
                  </span>
                </article>
              ))}
              {enrichedProviders.length === 0 && (
                <div className="bdm-empty">
                  <strong>Sem resultados publicados para esta pesquisa.</strong>
                  <span>Experimenta outra especialidade ou remove o filtro de categoria.</span>
                  <Link href={buildHref(null)}>Limpar filtros</Link>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="bdm-right-panel">
          <div className="bdm-promo">
            <div className="bdm-eyebrow">Faz parte da plataforma</div>
            <h2>Queres ser <em>Mestre?</em></h2>
            <p>Regista-te e recebe pedidos de clientes perto de ti.</p>
            <Link href="/registo" className="bdm-promo-cta">Registar agora →</Link>
          </div>
          <div className="bdm-info-card">
            <div className="bdm-verified">
              <span className="bdm-verified-icon">✓</span>
              <span>
                <strong>Mestres verificados</strong>
                <small>Mais confiança em cada serviço.</small>
              </span>
            </div>
          </div>
          <div className="bdm-info-card bdm-service-card">
            <strong>Serviços</strong>
            <div className="bdm-service-links">
              <Link href="/chamar">Chamar agora</Link>
              <Link href={signedIn ? '/trabalhos' : '/entrar'}>Os meus trabalhos</Link>
              <Link href={signedIn ? '/pedidos' : '/entrar'}>Os meus pedidos</Link>
              <Link href="/notificacoes">Notificações</Link>
              <Link href="/pro/trabalhos">Área do mestre</Link>
              <Link href="/como-funciona">Como funciona</Link>
              <Link href="/ajuda">Ajuda</Link>
            </div>
          </div>
          {ad ? (
            <div className="bdm-ad-slot">
              <strong>{ad.label}</strong>
              {ad.href ? (
                <Link href={ad.href}>
                  <Image src={ad.src} alt={ad.alt} width={ad.width} height={ad.height} style={{ width: '100%', height: 'auto' }} />
                </Link>
              ) : (
                <Image src={ad.src} alt={ad.alt} width={ad.width} height={ad.height} style={{ width: '100%', height: 'auto' }} />
              )}
            </div>
          ) : null}
          <div className="bdm-help">
            <strong>Precisas de ajuda?</strong>
            <p>Estamos disponíveis para te apoiar.</p>
            <Link href="/ajuda">Falar com apoio</Link>
          </div>
        </aside>
      </main>
    </div>
  )
}
