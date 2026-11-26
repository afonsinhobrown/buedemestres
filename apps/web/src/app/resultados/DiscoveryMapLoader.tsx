'use client'

import dynamic from 'next/dynamic'
import type { DiscoveryProvider } from '@/lib/discovery'

const DiscoveryMap = dynamic(() => import('./DiscoveryMap'), {
  ssr: false,
  loading: () => (
    <div className="dx-map-loading" role="status">
      A carregar mapa…
    </div>
  ),
})

type Props = {
  providers: DiscoveryProvider[]
  activeSlug: string | null
  selectedSlug: string | null
  userLocation: [number, number] | null
  onSelect: (slug: string) => void
  onLocate: () => void
  locating: boolean
}

export default function DiscoveryMapLoader(props: Props) {
  return <DiscoveryMap {...props} />
}
