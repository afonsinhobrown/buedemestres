'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L, { type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Minus, Plus } from '@phosphor-icons/react'
import { ratingLabel, type DiscoveryProvider } from '@/lib/discovery'

type Props = {
  providers: DiscoveryProvider[]
  activeSlug: string | null
  selectedSlug: string | null
  userLocation: [number, number] | null
  onSelect: (slug: string) => void
  onLocate: () => void
  locating: boolean
}

const DEFAULT_CENTER: [number, number] = [-25.9666, 32.5833]

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function providerPin(provider: DiscoveryProvider, active: boolean) {
  const classes = [
    'dx-pin',
    active ? 'is-active' : '',
    provider.featured ? 'is-featured' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return L.divIcon({
    className: 'dx-pin-host',
    html: `<span class="${classes}"><span>${escapeHtml(provider.categoryIcon)}</span></span>`,
    iconSize: [38, 44],
    iconAnchor: [19, 40],
    popupAnchor: [0, -36],
  })
}

const userDot = L.divIcon({
  className: 'dx-pin-host',
  html: '<span class="dx-user-dot" aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function MapBridge({
  providers,
  selectedSlug,
  userLocation,
  onReady,
}: {
  providers: DiscoveryProvider[]
  selectedSlug: string | null
  userLocation: [number, number] | null
  onReady: (map: LeafletMap) => void
}) {
  const map = useMap()
  const fittedSignature = useRef('')
  const signature = providers
    .map((provider) => provider.slug)
    .sort()
    .join('|')

  useEffect(() => {
    onReady(map)
  }, [map, onReady])

  useEffect(() => {
    if (!map || fittedSignature.current === signature) return
    const points = providers
      .filter((provider) => provider.lat !== null && provider.lng !== null)
      .map((provider) => [provider.lat as number, provider.lng as number] as [number, number])

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [46, 46], maxZoom: 14 })
    } else if (points.length === 1) {
      map.setView(points[0], 14)
    }
    fittedSignature.current = signature
  }, [map, providers, signature])

  useEffect(() => {
    if (!map || !selectedSlug) return
    const provider = providers.find((item) => item.slug === selectedSlug)
    if (provider?.lat === null || provider?.lng === null || !provider) return
    map.flyTo([provider.lat, provider.lng], 15, { duration: 0.6 })
  }, [map, providers, selectedSlug])

  useEffect(() => {
    if (!map || !userLocation) return
    map.flyTo(userLocation, 14, { duration: 0.6 })
  }, [map, userLocation])

  return null
}

export default function DiscoveryMap({
  providers,
  activeSlug,
  selectedSlug,
  userLocation,
  onSelect,
  onLocate,
  locating,
}: Props) {
  const [map, setMap] = useState<LeafletMap | null>(null)

  return (
    <>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom
        className="dx-map"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBridge
          providers={providers}
          selectedSlug={selectedSlug}
          userLocation={userLocation}
          onReady={setMap}
        />

        {userLocation && (
          <Marker position={userLocation} icon={userDot}>
            <Popup>
              <div className="dx-popup">
                <strong>A tua localização</strong>
                <span>Usada para calcular a distância aos mestres.</span>
              </div>
            </Popup>
          </Marker>
        )}

        {providers.map((provider) => {
          if (provider.lat === null || provider.lng === null) return null
          const active = activeSlug === provider.slug || selectedSlug === provider.slug
          const rating = ratingLabel(provider.ratingAvg, provider.ratingCount)

          return (
            <Marker
              key={provider.slug}
              position={[provider.lat, provider.lng]}
              icon={providerPin(provider, active)}
              eventHandlers={{ click: () => onSelect(provider.slug) }}
            >
              <Popup>
                <div className="dx-popup">
                  <strong>{provider.businessName}</strong>
                  <span>
                    {provider.categoryName}
                    {provider.districtName ? ` · ${provider.districtName}` : ''}
                  </span>
                  <span>
                    {rating.isNew ? 'Novo na plataforma' : `★ ${rating.label} de 5`}
                  </span>
                  <Link href={`/mestre/${provider.slug}`}>Ver perfil →</Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <div className="dx-map-tools">
        <button
          type="button"
          className="dx-map-tool"
          onClick={() => map?.zoomIn()}
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          <Plus size={19} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dx-map-tool"
          onClick={() => map?.zoomOut()}
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
        >
          <Minus size={19} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dx-map-tool"
          onClick={onLocate}
          disabled={locating}
          aria-label="A minha localização"
          title="A minha localização"
        >
          <Crosshair size={19} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </>
  )
}
