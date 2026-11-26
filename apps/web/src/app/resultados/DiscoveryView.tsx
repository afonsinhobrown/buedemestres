'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  Crosshair,
  List,
  MagnifyingGlass,
  MapPin,
  ShieldCheck,
  SquaresFour,
  Star,
  X,
} from '@phosphor-icons/react'
import {
  distanceKm,
  findCategoryBySlug,
  formatDistanceKm,
  ratingLabel,
  type CategoryNode,
  type DiscoveryDistrict,
  type DiscoveryProvider,
} from '@/lib/discovery'
import DiscoveryMapLoader from './DiscoveryMapLoader'

type Stats = {
  total: number
  verified: number
  available: number
}

type CategorySelection = {
  category: CategoryNode
  parent: CategoryNode | null
} | null

type Props = {
  q: string
  categories: CategoryNode[]
  providers: DiscoveryProvider[]
  districts: DiscoveryDistrict[]
  selectedCategorySlug: string
  selectedDistrictId: number | null
  selectedDistrictName: string | null
  verifiedOnly: boolean
  availableOnly: boolean
  hasFilters: boolean
  stats: Stats
  isAuthenticated: boolean
  loadError: boolean
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function CategoryList({
  categories,
  selection,
  totalProviders,
  buildHref,
  expandAll = false,
  onNavigate,
}: {
  categories: CategoryNode[]
  selection: CategorySelection
  totalProviders: number
  buildHref: (slug: string | null) => string
  expandAll?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="dx-cat-list" aria-label="Categorias de serviço">
      <Link
        href={buildHref(null)}
        className={`dx-cat${selection ? '' : ' is-active'}`}
        aria-current={selection ? undefined : 'page'}
        onClick={onNavigate}
      >
        <span className="dx-cat-icon" aria-hidden="true">
          ⌕
        </span>
        <span>Todos os serviços</span>
        <span className="dx-cat-count">{totalProviders}</span>
      </Link>

      {categories.map((category) => {
        const isExact = selection?.category.id === category.id
        const isParent = selection?.parent?.id === category.id
        const expanded = expandAll || isExact || isParent

        return (
          <div key={category.id}>
            <Link
              href={buildHref(category.slug)}
              className={`dx-cat${isExact ? ' is-active' : ''}${isParent ? ' is-parent-active' : ''}`}
              aria-current={isExact ? 'page' : undefined}
              onClick={onNavigate}
            >
              <span className="dx-cat-icon" aria-hidden="true">
                {category.icon || '🛠️'}
              </span>
              <span>{category.name}</span>
              <span className="dx-cat-count">{category.totalProviders}</span>
            </Link>

            {expanded && category.children.length > 0 && (
              <div className="dx-subcats">
                {category.children.map((child) => {
                  const active = selection?.category.id === child.id
                  return (
                    <Link
                      key={child.id}
                      href={buildHref(child.slug)}
                      className={`dx-subcat${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                    >
                      <span>{child.name}</span>
                      <span className="dx-subcat-count">{child.provider_count}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export default function DiscoveryView({
  q,
  categories,
  providers,
  districts,
  selectedCategorySlug,
  selectedDistrictId,
  selectedDistrictName,
  verifiedOnly,
  availableOnly,
  hasFilters,
  stats,
  isAuthenticated,
  loadError,
}: Props) {
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const selection = useMemo(
    () => findCategoryBySlug(categories, selectedCategorySlug),
    [categories, selectedCategorySlug]
  )

  const quickCategories = useMemo(() => {
    if (selection?.parent) {
      return selection.parent.children.map((child) => ({
        ...child,
        icon: child.icon || selection.parent?.icon || '🛠️',
      }))
    }
    if (selection?.category) {
      return selection.category.children.map((child) => ({
        ...child,
        icon: child.icon || selection.category.icon || '🛠️',
      }))
    }
    return categories
      .flatMap((parent) =>
        parent.children.map((child) => ({
          ...child,
          icon: child.icon || parent.icon || '🛠️',
        }))
      )
      .filter((category) => category.provider_count > 0)
      .sort((a, b) => b.provider_count - a.provider_count || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [categories, selection])

  const activeSlug = hoveredSlug ?? selectedSlug
  const mapProviders = useMemo(
    () => providers.filter((provider) => provider.lat !== null && provider.lng !== null),
    [providers]
  )

  const buildParams = (categorySlug: string | null) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (selectedDistrictId) params.set('distrito', String(selectedDistrictId))
    if (verifiedOnly) params.set('verificado', '1')
    if (availableOnly) params.set('disponivel', '1')
    if (categorySlug) params.set('categoria', categorySlug)
    return params
  }

  const buildHref = (categorySlug: string | null) => {
    const query = buildParams(categorySlug).toString()
    return query ? `/resultados?${query}` : '/resultados'
  }

  const toggleHref = (key: 'verificado' | 'disponivel', active: boolean) => {
    const params = buildParams(selection?.category.slug ?? null)
    if (active) params.delete(key)
    else params.set(key, '1')
    const query = params.toString()
    return query ? `/resultados?${query}` : '/resultados'
  }

  const resultsTitle = q
    ? `Resultados para “${q.length > 42 ? `${q.slice(0, 42)}…` : q}”`
    : selection
      ? `Mestres: ${selection.category.name}`
      : 'Mestres disponíveis perto de ti'

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('O teu navegador não permite obter a localização.')
      return
    }

    setLocating(true)
    setLocateError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude])
        setLocating(false)
      },
      () => {
        setLocating(false)
        setLocateError('Não foi possível obter a tua localização. Verifica as permissões do navegador.')
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    )
  }

  const selectFromMap = (slug: string) => {
    setHoveredSlug(null)
    setSelectedSlug(slug)
    const card = document.getElementById(`dx-card-${slug}`)
    card?.scrollIntoView({ behavior: scrollBehavior(), inline: 'center', block: 'nearest' })
  }

  const scrollResults = (direction: -1 | 1) => {
    listRef.current?.scrollBy({ left: direction * 290, behavior: scrollBehavior() })
  }

  useEffect(() => {
    if (!categoriesOpen) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoriesOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [categoriesOpen])

  return (
    <div className="dx-page">
      <header className="dx-topbar">
        <Link href="/" className="dx-brand" aria-label="Bué de Mestres — início">
          <span className="dx-brand-mark" aria-hidden="true">
            🛠️
          </span>
          <span className="dx-brand-name">
            Bué de Mestres
            <span>O serviço certo, na hora certa, perto de ti.</span>
          </span>
        </Link>

        <div className="dx-top-actions">
          <span className="dx-top-location">
            <MapPin size={15} weight="fill" aria-hidden="true" />
            {selectedDistrictName ?? 'Moçambique'}
          </span>
          <Link href="/#como-funciona" className="dx-nav-link">
            Como funciona
          </Link>
          <Link href="/#para-mestres" className="dx-nav-link">
            Para mestres
          </Link>
          <Link href="/ajuda" className="dx-nav-link">
            Ajuda
          </Link>
          {isAuthenticated ? (
            <Link href="/painel" className="dx-btn dx-btn-yellow">
              Painel
              <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link href="/entrar" className="dx-nav-link dx-login">
                Entrar
              </Link>
              <Link href="/registar" className="dx-btn dx-btn-yellow">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="dx-app">
        <h1 className="dx-sr-only">Encontrar mestres perto de ti</h1>

        <aside className="dx-left dx-panel" aria-label="Categorias">
          <div className="dx-panel-head">
            <List size={17} weight="bold" aria-hidden="true" />
            Categorias
          </div>
          <CategoryList
            categories={categories}
            selection={selection}
            totalProviders={stats.total}
            buildHref={buildHref}
          />
          <div className="dx-left-foot">
            <button
              type="button"
              className="dx-clear"
              onClick={() => setCategoriesOpen(true)}
            >
              Ver todas as categorias
            </button>
            <p className="dx-left-note">
              Escolhe uma especialidade para veres os profissionais disponíveis no mapa.
            </p>
          </div>
        </aside>

        <section className="dx-center" aria-label="Mapa e resultados">
          <div className="dx-map-shell" role="region" aria-label="Mapa de mestres">
            <form className="dx-search" action="/resultados" method="get" role="search">
              <MagnifyingGlass
                className="dx-search-icon"
                size={21}
                weight="bold"
                aria-hidden="true"
              />
              <label className="dx-sr-only" htmlFor="dx-q">
                Pesquisar serviço
              </label>
              <input
                id="dx-q"
                name="q"
                defaultValue={q}
                placeholder="Ex.: mecânico, canalizador, electricista..."
                autoComplete="off"
              />
              <label className="dx-sr-only" htmlFor="dx-district">
                Distrito
              </label>
              <select
                id="dx-district"
                name="distrito"
                defaultValue={selectedDistrictId ? String(selectedDistrictId) : ''}
                aria-label="Filtrar por distrito"
              >
                <option value="">Todos os distritos</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
              {selection && (
                <input type="hidden" name="categoria" value={selection.category.slug} />
              )}
              {verifiedOnly && <input type="hidden" name="verificado" value="1" />}
              {availableOnly && <input type="hidden" name="disponivel" value="1" />}
              <button type="submit" className="dx-search-btn">
                Pesquisar
              </button>
            </form>

            <DiscoveryMapLoader
              providers={mapProviders}
              activeSlug={activeSlug}
              selectedSlug={selectedSlug}
              userLocation={userLocation}
              onSelect={selectFromMap}
              onLocate={locate}
              locating={locating}
            />

            <div className="dx-map-status" role="status" aria-live="polite">
              <span
                className={`dx-dot${providers.length === 0 ? ' is-empty' : ''}`}
                aria-hidden="true"
              />
              {providers.length === 0
                ? 'Nenhum mestre encontrado'
                : providers.length === 1
                  ? '1 mestre encontrado'
                  : `${providers.length} mestres encontrados`}
            </div>

            <button
              type="button"
              className="dx-locate"
              onClick={locate}
              disabled={locating}
            >
              <Crosshair size={15} weight="bold" aria-hidden="true" />
              {locating ? 'A localizar…' : 'A minha localização'}
            </button>

            <div className="dx-map-legend" aria-hidden="true">
              <span className="dx-legend-item">
                <i className="dx-legend-dot" /> Mestre
              </span>
              <span className="dx-legend-item">
                <i className="dx-legend-dot is-selected" /> Selecionado
              </span>
              <span className="dx-legend-item">
                <i className="dx-legend-dot is-user" /> Tu
              </span>
            </div>

            {locateError && (
              <div className="dx-map-toast" role="status">
                {locateError}
              </div>
            )}
          </div>

          <section className="dx-results" aria-labelledby="dx-results-title">
            {loadError && (
              <div className="dx-alert" role="alert">
                Não foi possível carregar os mestres agora.{' '}
                <Link href="/resultados">Tentar novamente</Link>
              </div>
            )}

            <div className="dx-results-head">
              <div>
                <span id="dx-results-title" className="dx-results-title">
                  {resultsTitle}
                </span>
                <span className="dx-results-count" aria-live="polite">
                  {providers.length} {providers.length === 1 ? 'encontrado' : 'encontrados'}
                </span>
              </div>
              <div className="dx-results-actions">
                {hasFilters && (
                  <Link href="/resultados" className="dx-clear">
                    Limpar filtros
                  </Link>
                )}
                <button
                  type="button"
                  className="dx-icon-btn dx-mobile-cats"
                  onClick={() => setCategoriesOpen(true)}
                  aria-label="Abrir categorias"
                >
                  <SquaresFour size={19} weight="bold" aria-hidden="true" />
                </button>
                <div className="dx-carousel-arrows">
                  <button
                    type="button"
                    className="dx-icon-btn"
                    onClick={() => scrollResults(-1)}
                    aria-label="Resultados anteriores"
                  >
                    <CaretLeft size={18} weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="dx-icon-btn"
                    onClick={() => scrollResults(1)}
                    aria-label="Próximos resultados"
                  >
                    <CaretRight size={18} weight="bold" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <div className="dx-chips" aria-label="Filtros rápidos">
              <Link
                href={buildHref(null)}
                className={`dx-chip${selection ? '' : ' is-active'}`}
                aria-current={selection ? undefined : 'page'}
              >
                Todos
              </Link>
              {quickCategories.map((category) => {
                const active = selection?.category.id === category.id
                return (
                  <Link
                    key={category.id}
                    href={buildHref(category.slug)}
                    className={`dx-chip${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {category.icon && <span aria-hidden="true">{category.icon}</span>}
                    {category.name}
                  </Link>
                )
              })}
              <Link
                href={toggleHref('verificado', verifiedOnly)}
                className={`dx-chip${verifiedOnly ? ' is-active' : ''}`}
                aria-current={verifiedOnly ? 'page' : undefined}
              >
                <ShieldCheck size={14} weight="fill" aria-hidden="true" />
                Verificados
              </Link>
              <Link
                href={toggleHref('disponivel', availableOnly)}
                className={`dx-chip${availableOnly ? ' is-active' : ''}`}
                aria-current={availableOnly ? 'page' : undefined}
              >
                <span className="dx-chip-dot" aria-hidden="true" />
                Disponíveis
              </Link>
            </div>

            {providers.length === 0 ? (
              <div className="dx-empty">
                <MagnifyingGlass
                  className="dx-empty-icon"
                  size={28}
                  weight="bold"
                  aria-hidden="true"
                />
                <h3>Não encontrámos mestres para esta pesquisa</h3>
                <p>
                  Experimenta outra categoria, remove os filtros ou publica um pedido para
                  receberes propostas de mestres perto de ti.
                </p>
                <div className="dx-empty-actions">
                  <Link href="/resultados" className="dx-btn dx-btn-ghost">
                    Limpar filtros
                  </Link>
                  <Link href="/pedidos/novo" className="dx-btn dx-btn-blue">
                    Publicar pedido
                  </Link>
                </div>
              </div>
            ) : (
              <div className="dx-result-list" ref={listRef}>
                {providers.map((provider) => {
                  const rating = ratingLabel(provider.ratingAvg, provider.ratingCount)
                  const distance =
                    userLocation && provider.lat !== null && provider.lng !== null
                      ? formatDistanceKm(
                          distanceKm(
                            { lat: userLocation[0], lng: userLocation[1] },
                            { lat: provider.lat, lng: provider.lng }
                          )
                        )
                      : null

                  return (
                    <article
                      key={provider.slug}
                      id={`dx-card-${provider.slug}`}
                      className={`dx-card${activeSlug === provider.slug ? ' is-active' : ''}`}
                    >
                      <Link
                        href={`/mestre/${provider.slug}`}
                        className="dx-card-link"
                        aria-label={`Ver perfil de ${provider.businessName}`}
                        onMouseEnter={() => setHoveredSlug(provider.slug)}
                        onMouseLeave={() => setHoveredSlug(null)}
                        onFocus={() => setHoveredSlug(provider.slug)}
                        onBlur={() => setHoveredSlug(null)}
                      >
                        <span className="dx-card-icon" aria-hidden="true">
                          {provider.categoryIcon}
                        </span>
                        <span className="dx-card-copy">
                          <span className="dx-card-name">
                            {provider.businessName}
                            {provider.verified && (
                              <ShieldCheck
                                className="dx-verified-icon"
                                size={14}
                                weight="fill"
                                aria-label="Verificado"
                              />
                            )}
                            {provider.featured && (
                              <span className="dx-featured">Destaque</span>
                            )}
                          </span>
                          <span className="dx-card-sub">
                            {provider.headline ||
                              (provider.districtName
                                ? `Mestre em ${provider.districtName}`
                                : 'Mestre na Bué de Mestres')}
                          </span>
                          <span className="dx-card-meta">
                            {rating.isNew ? (
                              <span className="dx-new">Novo</span>
                            ) : (
                              <span
                                className="dx-rating"
                                aria-label={`Avaliação ${rating.label} de 5`}
                              >
                                <Star size={11} weight="fill" aria-hidden="true" />
                                {rating.label}
                              </span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{provider.categoryName}</span>
                          </span>
                          <span className="dx-card-meta">
                            <span>{distance ?? provider.districtName ?? 'Moçambique'}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                provider.available ? 'dx-available' : 'dx-unavailable'
                              }
                            >
                              {provider.available ? 'Disponível agora' : 'Ocupado'}
                            </span>
                          </span>
                        </span>
                        <span className="dx-card-arrow" aria-hidden="true">
                          <ArrowRight size={16} weight="bold" />
                        </span>
                      </Link>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>

        <aside className="dx-right" aria-label="Informações e apoio">
          <div className="dx-promo">
            <span className="dx-eyebrow">Faz parte da plataforma</span>
            <h2>
              Queres ser <em>Mestre?</em>
            </h2>
            <p>Regista-te e recebe pedidos de serviços de clientes perto de ti.</p>
            <Link href="/registar?redirect=/pro/activar" className="dx-btn dx-btn-yellow">
              Registar agora
              <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </Link>
          </div>

          <div className="dx-info">
            <span className="dx-info-icon" aria-hidden="true">
              <ShieldCheck size={22} weight="fill" />
            </span>
            <div>
              <h3>Mestres verificados</h3>
              <p>
                {stats.verified} de {stats.total} perfis publicados têm verificação
                aprovada. Mais confiança em cada serviço.
              </p>
            </div>
          </div>

          <div className="dx-ad">
            <span className="dx-eyebrow">Publicidade</span>
            <strong>Espaço para parceiros</strong>
            <p>Publicidade discreta, sem retirar protagonismo ao mapa e à procura de serviços.</p>
            <Link href="/ajuda">Quero anunciar</Link>
          </div>

          <div className="dx-help">
            <strong>Precisas de ajuda?</strong>
            <p>Estamos disponíveis para te apoiar.</p>
            <div className="dx-help-actions">
              <Link href="/ajuda" className="dx-btn">
                Falar com o apoio
              </Link>
              <a
                href="https://wa.me/258840000000"
                className="dx-btn dx-btn-whatsapp"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </div>

          <div className="dx-legal">
            <Link href="/termos">Termos</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacidade">Privacidade</Link>
          </div>
        </aside>
      </main>

      {categoriesOpen && (
        <div
          className="dx-drawer"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCategoriesOpen(false)
          }}
        >
          <div
            className="dx-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dx-cats-title"
          >
            <div className="dx-drawer-head">
              <h2 id="dx-cats-title">Categorias</h2>
              <button
                ref={closeButtonRef}
                type="button"
                className="dx-icon-btn"
                onClick={() => setCategoriesOpen(false)}
                aria-label="Fechar categorias"
              >
                <X size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="dx-drawer-scroll">
              <CategoryList
                categories={categories}
                selection={selection}
                totalProviders={stats.total}
                buildHref={buildHref}
                expandAll
                onNavigate={() => setCategoriesOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
