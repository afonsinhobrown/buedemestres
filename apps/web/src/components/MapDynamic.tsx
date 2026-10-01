'use client';
import dynamic from 'next/dynamic';

// Disable SSR for Map because it uses window/navigator
const MapComponent = dynamic(() => import('./Map'), { 
  ssr: false, 
  loading: () => <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center'}}>A carregar mapa...</div> 
});

export default function MapDynamic({ providers }: { providers: any }) {
  return <MapComponent providers={providers} />;
}
