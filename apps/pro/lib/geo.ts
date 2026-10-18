export type GeoPoint = { lat: number; lng: number }

/** Distância máxima, em metros, para o mestre poder confirmar a chegada. */
export const MAX_ARRIVAL_DISTANCE_M = 200

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function parseHexWkb(value: string): GeoPoint | null {
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length < 50) return null
  try {
    const bytes = new Uint8Array(value.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
    const view = new DataView(bytes.buffer)
    const littleEndian = view.getUint8(0) === 1
    let offset = 5
    const type = view.getUint32(1, littleEndian)
    if (type & 0x20000000) offset += 4
    if ((type & 0xff) === 1) {
      const lng = view.getFloat64(offset, littleEndian)
      const lat = view.getFloat64(offset + 8, littleEndian)
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }
    return null
  } catch {
    return null
  }
}

/** Verdadeiro quando o mestre está dentro do raio permitido para confirmar a chegada. */
export function canConfirmArrival(
  provider: GeoPoint,
  client: GeoPoint,
  maxDistanceM: number = MAX_ARRIVAL_DISTANCE_M
): boolean {
  return distanceMeters(provider, client) <= maxDistanceM
}

export function parseGeoPoint(value: unknown): GeoPoint | null {
  if (!value) return null

  if (typeof value === 'object') {
    const anyValue = value as any
    if (Number.isFinite(anyValue.lat) && Number.isFinite(anyValue.lng)) {
      return { lat: Number(anyValue.lat), lng: Number(anyValue.lng) }
    }
    if (Number.isFinite(anyValue.latitude) && Number.isFinite(anyValue.longitude)) {
      return { lat: Number(anyValue.latitude), lng: Number(anyValue.longitude) }
    }
    if (Array.isArray(anyValue.coordinates) && anyValue.coordinates.length >= 2) {
      return { lat: Number(anyValue.coordinates[1]), lng: Number(anyValue.coordinates[0]) }
    }
    return null
  }

  if (typeof value !== 'string') return null
  const text = value.trim()

  const pointMatch = text.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
  if (pointMatch) {
    return { lat: Number(pointMatch[2]), lng: Number(pointMatch[1]) }
  }

  if (text.startsWith('{')) {
    try {
      return parseGeoPoint(JSON.parse(text))
    } catch {
      return null
    }
  }

  return parseHexWkb(text)
}
