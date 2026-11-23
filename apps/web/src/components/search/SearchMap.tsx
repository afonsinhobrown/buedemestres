'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export type SearchMapPosition = [number, number]

export type SearchMapProvider = {
  id: string
  slug: string
  name: string
  headline: string | null
  categoryName: string | null
  categoryIcon: string | null
  categorySlug: string | null
  districtName: string | null
  rating: number
  ratingCount: number
  verified: boolean
  available: boolean
  featured: boolean
  lat: number
  lng: number
  distanceKm: number | null
  priceMin: number | null
}

type SearchMapProps = {
  providers: SearchMapProvider[]
  selectedId: string | null
  onSelect: (id: string) => void
  userPosition: SearchMapPosition | null
  onPosition: (position: SearchMapPosition) => void
}

const iconCache = new Map<string, L.DivIcon>()

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

function pinTone(slug: string | null): 'blue' | 'yellow' | 'green' {
  if (!slug) return 'blue'
  if (slug.includes('electric')) return 'yellow'
  if (slug.includes('canaliz') || slug.includes('limpez') || slug.includes('frio')) return 'green'
  return 'blue'
}

function pinIcon(icon: string | null, slug: string | null): L.DivIcon {
  const tone = pinTone(slug)
  const glyph = escapeHtml(icon || '⚙')
  const key = `${tone}:${glyph}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const created = L.divIcon({
    className: 'bdm-pin-wrap',
    html: `<div class="bdm-pin bdm-pin--${tone}"><span>${glyph}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -32],
    tooltipAnchor: [0, -30],
  })
  iconCache.set(key, created)
  return created
}

function MapBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function FitBounds({ points }: { points: SearchMapPosition[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false })
      return
    }
    map.fitBounds(points, { padding: [48, 48], maxZoom: 15, animate: false })
    const timer = window.setTimeout(() => map.invalidateSize(), 120)
    return () => window.clearTimeout(timer)
  }, [map, points])
  return null
}

function FocusPoint({ point }: { point: SearchMapPosition | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo(point, 15, { duration: 0.5 })
  }, [map, point])
  return null
}

export default function SearchMap({
  providers,
  selectedId,
  onSelect,
  userPosition,
  onPosition,
}: SearchMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [locationError, setLocationError] = useState(false)

  const handleReady = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  const points = useMemo<SearchMapPosition[]>(
    () => providers.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => [p.lat, p.lng]),
    [providers],
  )

  const selectedPoint = useMemo<SearchMapPosition | null>(() => {
    const selected = providers.find((p) => p.id === selectedId)
    return selected ? [selected.lat, selected.lng] : null
  }, [providers, selectedId])

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocationError(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: SearchMapPosition = [position.coords.latitude, position.coords.longitude]
        setLocationError(false)
        onPosition(next)
        mapRef.current?.flyTo(next, 15, { duration: 0.6 })
      },
      () => setLocationError(true),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }

  return (
    <div className="bdm-map-canvas">
      <MapContainer
        center={points[0] ?? [0, 0]}
        zoom={points.length ? 13 : 2}
        zoomControl={false}
        scrollWheelZoom
        className="bdm-leaflet"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapBridge onReady={handleReady} />
        <FitBounds points={points} />
        <FocusPoint point={selectedPoint} />

        {userPosition && (
          <Marker position={userPosition} icon={pinIcon('◎', 'user')}>
            <Popup>A tua localização atual</Popup>
          </Marker>
        )}

        {providers.map((provider) => (
          <Marker
            key={provider.id}
            position={[provider.lat, provider.lng]}
            icon={pinIcon(provider.categoryIcon, provider.categorySlug)}
            eventHandlers={{ click: () => onSelect(provider.id) }}
          >
            <Tooltip direction="top" opacity={1}>
              <strong>{provider.name}</strong>
              <br />
              {provider.categoryName || 'Serviço'} · ★ {provider.rating.toFixed(1)}
            </Tooltip>
            <Popup>
              <div className="bdm-map-popup">
                <strong>{provider.name}</strong>
                <span>{provider.categoryName || 'Serviço'}</span>
                {provider.districtName && <span>{provider.districtName}</span>}
                <span>★ {provider.rating.toFixed(1)} · {provider.ratingCount} avaliações</span>
                <LinkToProfile slug={provider.slug} />
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="bdm-map-tools">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} title="Aumentar zoom" aria-label="Aumentar zoom">＋</button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} title="Diminuir zoom" aria-label="Diminuir zoom">−</button>
      </div>
      <button type="button" className="bdm-locate" onClick={locate}>
        ◎ A minha localização
      </button>
      {locationError && (
        <span className="bdm-location-error" role="status">
          Não foi possível obter a localização.
        </span>
      )}
    </div>
  )
}

function LinkToProfile({ slug }: { slug: string }) {
  return (
    <a className="bdm-popup-link" href={`/mestre/${slug}`}>
      Ver perfil
    </a>
  )
}
