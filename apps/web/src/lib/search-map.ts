export type SearchSort = 'relevance' | 'rating' | 'distance' | 'price'

type Point = [number, number]

type ProviderLike = {
  rating: number
  priceMin: number | null
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

export function haversineKm(from: Point, to: Point): number {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(to[0] - from[0])
  const dLng = toRadians(to[1] - from[1])
  const lat1 = toRadians(from[0])
  const lat2 = toRadians(to[1])
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function sortSearchProviders<T extends ProviderLike>(
  providers: T[],
  sort: SearchSort,
  userPosition: Point | null,
): T[] {
  const copy = [...providers]
  if (sort === 'rating') {
    return copy.sort((a, b) => b.rating - a.rating)
  }
  if (sort === 'price') {
    return copy.sort((a, b) => {
      if (a.priceMin == null) return 1
      if (b.priceMin == null) return -1
      return a.priceMin - b.priceMin
    })
  }
  if (sort === 'distance' && userPosition) {
    return copy.sort(
      (a, b) => haversineKm(userPosition, [a.lat, a.lng]) - haversineKm(userPosition, [b.lat, b.lng]),
    )
  }
  return copy
}
