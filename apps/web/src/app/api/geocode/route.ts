import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const HEADERS = {
  'User-Agent': 'BuedeMestres/1.0 (admin@buedemestres.com)',
  'Accept-Language': 'pt',
}

type NominatimResult = {
  place_id: number | string
  display_name: string
  lat: string
  lon: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  try {
    if (lat && lon) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`,
        { headers: HEADERS, next: { revalidate: 86400 } }
      )
      if (!response.ok) return NextResponse.json({ label: null }, { status: 502 })
      const data = await response.json()
      return NextResponse.json({ label: data.display_name ?? null })
    }

    if (!query || query.length < 3) return NextResponse.json([])

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&countrycodes=mz&addressdetails=1`,
      { headers: HEADERS, next: { revalidate: 3600 } }
    )
    if (!response.ok) return NextResponse.json([], { status: 502 })

    const data = (await response.json()) as NominatimResult[]
    return NextResponse.json(
      data.map((item) => ({
        id: String(item.place_id),
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
    )
  } catch {
    return NextResponse.json({ error: 'geocoding indisponível' }, { status: 502 })
  }
}
