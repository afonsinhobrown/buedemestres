import MapView, { Marker, Polyline } from 'react-native-maps'
import { StyleSheet, View } from 'react-native'

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
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const AnyMapView = MapView as any
  const AnyMarker = Marker as any
  const AnyPolyline = Polyline as any

  return (
    <AnyMapView
      style={styles.map}
      region={{
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.6),
        longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.6),
      }}
    >
      {provider && <AnyMarker coordinate={{ latitude: provider.lat, longitude: provider.lng }} title="Mestre" pinColor="#2444C8" />}
      {client && <AnyMarker coordinate={{ latitude: client.lat, longitude: client.lng }} title="Cliente" pinColor="#DC2626" />}
      {provider && client && (
        <AnyPolyline
          coordinates={[
            { latitude: provider.lat, longitude: provider.lng },
            { latitude: client.lat, longitude: client.lng },
          ]}
          strokeColor="#2444C8"
          strokeWidth={3}
        />
      )}
    </AnyMapView>
  )
}

const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 220 },
  empty: { flex: 1, backgroundColor: '#D4CFB8', minHeight: 220 },
})
