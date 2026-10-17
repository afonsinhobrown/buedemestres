import React from 'react'
import { View, StyleSheet } from 'react-native'

export type MapPoint = { lat: number; lng: number }

type Props = {
  provider?: MapPoint | null
  client?: MapPoint | null
  height?: number
}

export default function MapaTracking({ provider, client }: Props) {
  const focus = provider || client
  if (!focus) return <View style={styles.empty} />

  const points = [provider, client].filter(Boolean) as MapPoint[]
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const pad = 0.01
  const bbox = [
    Math.min(...lngs) - pad,
    Math.min(...lats) - pad,
    Math.max(...lngs) + pad,
    Math.max(...lats) + pad,
  ].join('%2C')

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${focus.lat}%2C${focus.lng}`

  return React.createElement('iframe' as any, {
    src,
    style: { border: 0, width: '100%', height: '100%', minHeight: 220 },
    title: 'Mapa de acompanhamento',
  })
}

const styles = StyleSheet.create({
  empty: { flex: 1, backgroundColor: '#D4CFB8' },
})
