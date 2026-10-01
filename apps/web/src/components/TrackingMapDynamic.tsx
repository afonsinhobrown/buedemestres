'use client';
import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('./TrackingMap'), { 
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-gray-100">Carregando mapa em tempo real...</div>
});

export default function TrackingMapDynamic(props: any) {
  return <TrackingMap {...props} />;
}
