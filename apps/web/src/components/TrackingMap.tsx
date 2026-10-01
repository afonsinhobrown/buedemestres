'use client';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pusherClient } from '@/lib/pusherClient';

// Fix leaflet icon
const carIcon = L.divIcon({
  html: '<div style="font-size: 32px; background: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🚗</div>',
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const clientIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Component to smooth pan the map to the car location
function MapPanner({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 1 });
  }, [lat, lng, map]);
  return null;
}

export default function TrackingMap({ jobId, initialLat, initialLng }: { jobId: string, initialLat: number, initialLng: number }) {
  const [providerLocation, setProviderLocation] = useState<{lat: number, lng: number, status?: string} | null>(null);

  useEffect(() => {
    // Sem Pusher configurado não há canal para assinar
    if (!pusherClient) return;
    const client = pusherClient;

    // Inscreve-se no canal exclusivo deste serviço
    const channel = client.subscribe(`job-${jobId}`);

    // Fica à escuta de eventos 'location-update'
    channel.bind('location-update', (data: { lat: number, lng: number, status?: string }) => {
      console.log('Recebido update do Pusher:', data);
      setProviderLocation({ lat: data.lat, lng: data.lng, status: data.status });
    });

    return () => {
      client.unsubscribe(`job-${jobId}`);
    };
  }, [jobId]);

  const hasArrived = providerLocation?.status === 'arrived';

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={[initialLat, initialLng]} 
        zoom={15} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Marcador Fixo do Cliente */}
        <Marker position={[initialLat, initialLng]} icon={clientIcon}>
          <Popup>Sua localização (Destino)</Popup>
        </Marker>

        {/* Marcador Dinâmico do Mestre */}
        {providerLocation && (
          <>
            <Marker position={[providerLocation.lat, providerLocation.lng]} icon={carIcon}>
              <Popup>{hasArrived ? 'O Mestre chegou!' : 'Mestre a caminho!'}</Popup>
            </Marker>
            {!hasArrived && <MapPanner lat={providerLocation.lat} lng={providerLocation.lng} />}
          </>
        )}
      </MapContainer>

      {/* OVERLAY DE CHEGADA */}
      {hasArrived && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center transform scale-105 transition-transform animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-green-600 mb-2">O Mestre Chegou!</h2>
            <p className="text-gray-600">Por favor, vá ao encontro do profissional.</p>
          </div>
        </div>
      )}
    </div>
  );
}
