'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import type { SearchMapPosition, SearchMapProvider } from './SearchMap'

const SearchMap = dynamic(() => import('./SearchMap'), {
  ssr: false,
  loading: () => <div className="bdm-map-loading">A carregar mapa…</div>,
})

export default function HomeMap({ providers }: { providers: SearchMapProvider[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [userPosition, setUserPosition] = useState<SearchMapPosition | null>(null)

  if (providers.length === 0) {
    return (
      <div className="home-map-empty">
        <strong>Ainda não há mestres com localização publicada.</strong>
        <Link href="/resultados">Abrir a pesquisa completa</Link>
      </div>
    )
  }

  return (
    <div className="home-map-preview">
      <SearchMap
        providers={providers}
        selectedId={selectedId}
        onSelect={setSelectedId}
        userPosition={userPosition}
        onPosition={setUserPosition}
      />
    </div>
  )
}
