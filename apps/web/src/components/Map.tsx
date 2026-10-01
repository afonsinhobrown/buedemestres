'use client';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix missing marker icons in leaflet
const iconProvider = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const iconUser = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to dynamically set map center
function SetViewOnClick({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, 14, { animate: true });
    }
  }, [coords, map]);
  return null;
}

type ProviderMapItem = {
  slug: string;
  business_name: string;
  headline: string;
  category_name: string;
  lat: number | null;
  lng: number | null;
  rating_avg: number;
};

export default function Map({ providers }: { providers: ProviderMapItem[] }) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Request user location on mount
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error obtaining location:", error);
          // Default to Maputo City center if denied or failed
          setUserLocation([-25.9666, 32.5833]);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      // Default to Maputo City center
      setUserLocation([-25.9666, 32.5833]);
    }
  }, []);

  const defaultCenter: [number, number] = [-25.9666, 32.5833];

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '300px' }}>
      <MapContainer 
        center={userLocation || defaultCenter} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userLocation && (
          <>
            <SetViewOnClick coords={userLocation} />
            <Marker position={userLocation} icon={iconUser}>
              <Popup>
                <b>A sua localização atual</b>
              </Popup>
            </Marker>
          </>
        )}

        {providers.map((p) => {
          if (!p.lat || !p.lng) return null;
          return (
            <Marker key={p.slug} position={[Number(p.lat), Number(p.lng)]} icon={iconProvider}>
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <b style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>{p.business_name}</b>
                  <span style={{ display: 'block', color: '#666' }}>{p.category_name}</span>
                  <span style={{ display: 'block', marginTop: '4px' }}>⭐ {p.rating_avg}</span>
                  <a href={`/mestre/${p.slug}`} style={{ display: 'inline-block', marginTop: '8px', padding: '4px 8px', background: '#2444C8', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                    Ver perfil
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
