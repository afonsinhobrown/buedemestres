'use client';

import React, { useState } from 'react';
import { requestServiceAction } from '@/app/actions/jobs';

export default function RequestServiceModal({ providerId, providerName }: { providerId: string, providerName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn b1 flex-1 text-center py-3 w-full">
        Chamar Agora
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative">
            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-4 right-4 text-gray-500 hover:text-black font-bold"
            >
              ✕
            </button>
            
            <h2 className="text-2xl font-bold mb-2">Chamar {providerName}</h2>
            <p className="text-sm text-gray-600 mb-6">Preencha os seus dados. O mestre será notificado no imediato.</p>
            
            <form action={requestServiceAction} className="flex flex-col gap-4">
              <input type="hidden" name="providerId" value={providerId} />
              
              <div className="flex flex-col gap-1">
                <label className="font-bold text-sm">O seu Nome</label>
                <input name="clientName" required className="inp" placeholder="João Silva" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-sm">O seu Telemóvel</label>
                <input name="clientPhone" required className="inp" placeholder="84..." />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-sm">Qual é o problema?</label>
                <textarea name="problem" required className="inp" rows={3} placeholder="Ex: O pneu furou e preciso de reboque..." />
              </div>

              <button type="submit" className="btn b1 mt-4">Confirmar Pedido</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
