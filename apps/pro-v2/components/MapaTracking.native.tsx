import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

export type MapPoint = { lat: number; lng: number }

type Props = {
  provider?: MapPoint | null
  client?: MapPoint | null
  height?: number
}

/**
 * Usa o mapa embed do OpenStreetMap dentro de uma WebView.
 *
 * O react-native-maps no Android depende da Google Maps SDK e de uma API key
 * configurada no projeto nativo. Sem essa chave o mapa abre em branco/crasha,
 * por isso usamos o OSM (sem chave) também no telemóvel.
 */
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

  const uri = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${focus.lat}%2C${focus.lng}`

  const AnyWebView = WebView as any

  return (
    <View style={styles.container}>
      <AnyWebView
        source={{ uri }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        mixedContentMode="always"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 220, overflow: 'hidden' },
  map: { flex: 1, minHeight: 220 },
  empty: { flex: 1, backgroundColor: '#D4CFB8', minHeight: 220 },
})
