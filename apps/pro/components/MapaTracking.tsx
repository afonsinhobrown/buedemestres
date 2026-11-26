import React, { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

export type MapPoint = { lat: number; lng: number }

type Props = {
  provider?: MapPoint | null
  client?: MapPoint | null
  height?: number
}

const EMPTY_HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;background:#D4CFB8"></body></html>`

function buildHtml(provider: MapPoint | null, client: MapPoint | null): string {
  const providerJson = JSON.stringify(provider)
  const clientJson = JSON.stringify(client)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #D4CFB8; }
    .pin-client { font-size: 22px; line-height: 22px; }
    .pin-provider { font-size: 22px; line-height: 22px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    function emojiIcon(emoji) {
      return L.divIcon({ html: '<div>' + emoji + '</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
    }

    var clientMarker = null;
    var providerMarker = null;
    var line = null;

    function render(provider, client) {
      if (client) {
        if (!clientMarker) {
          clientMarker = L.marker([client.lat, client.lng], { icon: emojiIcon('🏠') }).addTo(map);
        } else {
          clientMarker.setLatLng([client.lat, client.lng]);
        }
      }
      if (provider) {
        if (!providerMarker) {
          providerMarker = L.marker([provider.lat, provider.lng], { icon: emojiIcon('🛵') }).addTo(map);
        } else {
          providerMarker.setLatLng([provider.lat, provider.lng]);
        }
      }
      var points = [];
      if (provider) points.push([provider.lat, provider.lng]);
      if (client) points.push([client.lat, client.lng]);
      if (line) { map.removeLayer(line); line = null; }
      if (points.length === 2) {
        line = L.polyline(points, { color: '#12163A', weight: 3, dashArray: '6 6' }).addTo(map);
      }
      if (points.length === 1) {
        map.setView(points[0], 15);
      } else if (points.length > 1) {
        map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
      }
    }

    window.atualizarMapa = function (provider, client) {
      render(provider, client);
    };

    window.focar = function () {
      var points = [];
      if (providerMarker) points.push(providerMarker.getLatLng());
      if (clientMarker) points.push(clientMarker.getLatLng());
      if (points.length === 1) map.setView(points[0], 15);
      else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    };

    render(${providerJson}, ${clientJson});
  </script>
</body>
</html>`
}

function buildUpdateScript(provider: MapPoint | null, client: MapPoint | null): string {
  return `window.atualizarMapa(${JSON.stringify(provider)}, ${JSON.stringify(client)}); true;`
}

export default function MapaTracking({ provider, client }: Props) {
  const webRef = useRef<WebView>(null)
  const initialHtml = useMemo(() => buildHtml(provider ?? null, client ?? null), [])
  const hasFocus = Boolean(provider || client)

  useEffect(() => {
    if (!hasFocus) return
    webRef.current?.injectJavaScript(buildUpdateScript(provider ?? null, client ?? null))
  }, [provider?.lat, provider?.lng, client?.lat, client?.lng, hasFocus, provider, client])

  if (!hasFocus) return <View style={styles.empty} />

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: initialHtml }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 220, overflow: 'hidden', borderRadius: 16 },
  webview: { flex: 1, backgroundColor: '#D4CFB8' },
  empty: { flex: 1, backgroundColor: '#D4CFB8' },
})
