'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type PickedLocation = {
  lat: number
  lng: number
  address: string
}

type Suggestion = {
  id: string
  label: string
  lat: number
  lng: number
}

const DEFAULT_CENTER: [number, number] = [-25.9666, 32.5833]

const pickerIcon = L.divIcon({
  className: 'request-location-pin',
  html: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#2444C8;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.3);transform:rotate(-45deg)"><span style="display:block;width:12px;height:12px;margin:8px;border-radius:50%;background:#FFC400;transform:rotate(45deg)"></span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
})

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

function FlyToPoint({ point }: { point: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo(point, 15, { duration: 0.6 })
  }, [map, point])
  return null
}

export default function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null
  onChange: (location: PickedLocation) => void
}) {
  const [query, setQuery] = useState(value?.address ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    setQuery(value?.address ?? '')
  }, [value?.address])

  const search = async (text: string) => {
    if (text.trim().length < 3) {
      setSuggestions([])
      return
    }
    setSearching(true)
    setError(null)
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`)
      if (!response.ok) throw new Error('search failed')
      const data = (await response.json()) as Suggestion[]
      setSuggestions(Array.isArray(data) ? data : [])
    } catch {
      setSuggestions([])
      setError('Não foi possível procurar locais agora.')
    } finally {
      setSearching(false)
    }
  }

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setQuery(text)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => search(text), 350)
  }

  const selectSuggestion = (suggestion: Suggestion) => {
    setSuggestions([])
    onChange({ lat: suggestion.lat, lng: suggestion.lng, address: suggestion.label })
  }

  const reverse = async (lat: number, lng: number) => {
    setSearching(true)
    setError(null)
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`)
      const data = response.ok ? await response.json() : null
      const address = data?.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      onChange({ lat, lng, address })
    } catch {
      onChange({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
    } finally {
      setSearching(false)
    }
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('O dispositivo não permite obter a localização.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        reverse(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setLocating(false)
        setError('Não foi possível obter a tua localização. Escolhe no mapa.')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }

  const point: [number, number] | null = value ? [value.lat, value.lng] : null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="request-location" className="block text-sm font-medium text-[var(--color-tinta)]">
          Onde estás?
        </label>
        <input
          id="request-location"
          value={query}
          onChange={handleInput}
          placeholder="Ex.: Polana, Maputo"
          autoComplete="off"
          className="mt-1 flex h-[52px] w-full rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)] bg-[var(--color-papel)] px-3 py-2 text-base placeholder:text-[var(--color-zinco)] focus:outline-none focus:border-[var(--color-tinta)]"
        />
        {suggestions.length > 0 && (
          <div className="relative z-[1000] mt-1 max-h-52 overflow-auto rounded-xl border border-[var(--color-zinco-200)] bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                className="block w-full border-b border-[var(--color-zinco-200)] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[var(--color-cal)]"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-zinco)]">
          {searching ? 'A procurar…' : 'Escreve o bairro ou toca no mapa para marcar o local.'}
        </p>
        <button type="button" onClick={useMyLocation} disabled={locating} className="shrink-0 rounded-full border border-[var(--color-zinco-200)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-tinta)] disabled:opacity-60">
          {locating ? 'A localizar…' : 'Usar a minha localização'}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-oxido)]">{error}</p>}

      <div className="h-[280px] overflow-hidden rounded-xl border border-[var(--color-zinco-200)]">
        <MapContainer center={point ?? DEFAULT_CENTER} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={reverse} />
          <FlyToPoint point={point} />
          {point && (
            <Marker
              position={point}
              icon={pickerIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const marker = event.target as L.Marker
                  const position = marker.getLatLng()
                  reverse(position.lat, position.lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {value && (
        <p className="text-xs text-[var(--color-zinco)]">
          Local escolhido: {value.address}
        </p>
      )}
    </div>
  )
}
