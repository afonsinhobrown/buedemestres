'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TrackingMapDynamic from '@/components/TrackingMapDynamic';

export default function ViagemTestPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const isClientMode = searchParams.get('clientMode') === 'true';
  const [jobId, setJobId] = useState<string | null>(null);
  
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'held_in_escrow'>('unpaid');
  
  // Fake client location (Maputo Center)
  const clientLat = -25.9666;
  const clientLng = 32.5833;

  // Provider State
  const [isDriving, setIsDriving] = useState(false);
  const [providerLat, setProviderLat] = useState(-25.9600);
  const [providerLng, setProviderLng] = useState(32.5800);

  useEffect(() => {
    params.then(p => setJobId(p.id));
  }, [params]);

  // Simulador de movimento do Mestre
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDriving && jobId && paymentStatus === 'held_in_escrow') {
      interval = setInterval(async () => {
        // Simula o carro a mover-se ligeiramente na direcção do cliente
        let newLat = providerLat + (clientLat - providerLat) * 0.1;
        let newLng = providerLng + (clientLng - providerLng) * 0.1;
        
        // Verifica se chegou (distância muito curta)
        const dist = Math.sqrt(Math.pow(clientLat - newLat, 2) + Math.pow(clientLng - newLng, 2));
        let currentStatus = 'driving';
        
        if (dist < 0.0003) {
          newLat = clientLat;
          newLng = clientLng;
          currentStatus = 'arrived';
          setIsDriving(false); // Pára o carro
        }

        setProviderLat(newLat);
        setProviderLng(newLng);

        // Dispara para o nosso Backend via API
        await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            lat: newLat,
            lng: newLng,
            status: currentStatus
          })
        });
        
      }, 2000); // 2 em 2 segundos
    }
    return () => clearInterval(interval);
  }, [isDriving, providerLat, providerLng, jobId, paymentStatus]);

  // Handle PaySuite Payment
  const [phone, setPhone] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  
  const handlePayment = async () => {
    setIsPaying(true);
    // Para testes, vamos simular que o webhook/API aceitou, ou chamar a action real
    // Como a API deles pode falhar se não enviarmos payload perfeito, simulamos sucesso após 2s no Lab:
    setTimeout(() => {
       setPaymentStatus('held_in_escrow');
       setIsPaying(false);
    }, 2000);
  };

  if (!jobId) return <div className="p-8">A carregar serviço...</div>;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* PAINEL DO MESTRE (Esquerda) */}
      {!isClientMode && (
        <div className="w-1/3 bg-white border-r border-gray-300 flex flex-col">
          <div className="p-6 bg-[#12163A] text-white">
            <h2 className="text-2xl font-bold">App do Mestre</h2>
            <p className="text-sm opacity-80">Serviço: #{jobId}</p>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-6">
            
            {/* Estado do Pagamento no Mestre */}
            <div className="p-4 rounded-xl border bg-gray-50 border-gray-200">
               <h3 className="font-bold mb-2">Estado Financeiro</h3>
               {paymentStatus === 'unpaid' ? (
                 <p className="text-orange-600 flex items-center gap-2">⏳ A aguardar pagamento (1.500 MT)...</p>
               ) : (
                 <p className="text-green-600 font-bold flex items-center gap-2">✓ Pagamento Retido (Seguro)</p>
               )}
            </div>

            <div className={`p-4 rounded-xl border ${paymentStatus === 'unpaid' ? 'bg-gray-100 border-gray-200 opacity-50' : 'bg-blue-50 border-blue-100'}`}>
              <h3 className="font-bold text-blue-900 mb-2">Simulador GPS</h3>
              <p className="text-sm text-blue-800 mb-4">
                {paymentStatus === 'unpaid' 
                  ? 'Aguarde que o cliente efectue o pagamento via M-Pesa para arrancar.'
                  : 'Pagamento confirmado! Pode iniciar a marcha em direcção ao cliente.'}
              </p>
              
              <button 
                onClick={() => setIsDriving(!isDriving)}
                disabled={paymentStatus === 'unpaid'}
                className={`w-full py-4 rounded-lg font-bold text-white transition-colors ${isDriving ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isDriving ? '🛑 Parar o Carro' : '🚗 Começar a Conduzir'}
              </button>
            </div>

            <div className="mt-auto">
              <p className="text-xs text-gray-400 text-center">
                Coordenadas Actuais: {providerLat.toFixed(5)}, {providerLng.toFixed(5)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ECRÃ DO CLIENTE (Direita) */}
      <div className={`${isClientMode ? 'w-full' : 'w-2/3'} relative flex flex-col`}>
        <div className="absolute top-4 left-4 right-4 z-10 bg-white/90 backdrop-blur shadow-lg p-4 rounded-xl flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Ecrã do Cliente</h2>
            <p className="text-sm text-gray-600">A assistir via WebSockets (Pusher)</p>
          </div>
          
          {/* PAINEL DE PAGAMENTO CLIENTE */}
          {paymentStatus === 'unpaid' ? (
            <div className="flex gap-2 items-center bg-orange-100 p-2 rounded-lg">
               <input 
                 value={phone}
                 onChange={e => setPhone(e.target.value)}
                 placeholder="Número M-Pesa" 
                 className="p-2 border rounded text-sm w-32"
               />
               <button 
                 onClick={handlePayment} 
                 disabled={isPaying}
                 className="bg-orange-600 text-white font-bold py-2 px-4 rounded shadow hover:bg-orange-700 text-sm"
               >
                 {isPaying ? 'A Processar...' : 'Pagar 1.500 MT'}
               </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm font-bold text-green-700">Ligado ao Satélite (Pago)</span>
            </div>
          )}
        </div>
        
        {/* O MAPA REAL-TIME */}
        <div className="flex-1">
          <TrackingMapDynamic jobId={jobId} initialLat={clientLat} initialLng={clientLng} />
        </div>
      </div>

    </div>
  );
}
