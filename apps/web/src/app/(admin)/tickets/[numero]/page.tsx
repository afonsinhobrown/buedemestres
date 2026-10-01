export default function TicketAdminDetail({ params }: { params: { numero: string } }) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white p-4 border-b flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <a href="/admin/tickets" className="text-gray-400 hover:text-gray-900 font-bold">←</a>
          <h1 className="text-xl font-bold">{params.numero}</h1>
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold uppercase">Aguardar Cliente</span>
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold uppercase">Alta (SLA em risco)</span>
        </div>
        <div className="flex gap-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm">✔ Marcar como Resolvido</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat / Timeline */}
        <main className="flex-1 flex flex-col p-6 bg-white overflow-y-auto">
          <h2 className="text-lg font-bold mb-6">O cliente cancelou depois de eu chegar</h2>
          
          <div className="space-y-6 mb-6">
            <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl shadow-sm">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-gray-900">Mestre João M.</span>
                <span className="text-xs text-gray-400">Hoje, 10:15</span>
              </div>
              <p className="text-gray-700">Cheguei ao local combinado e liguei ao cliente, mas ele não atendeu. Fiquei à espera 30 minutos e depois ele cancelou o pedido na app. Como recebo a taxa de deslocação?</p>
            </div>

            {/* Internal Note */}
            <div className="border border-yellow-200 bg-yellow-50 p-4 rounded-xl shadow-sm">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-yellow-900">Operador (Afonso) 🔒 Nota Interna</span>
                <span className="text-xs text-yellow-600">Hoje, 10:45</span>
              </div>
              <p className="text-yellow-800">Verifiquei os logs de GPS (provider_presence) e ele esteve de facto no raio de 100m da casa do cliente. O cliente tem histórico de cancelamentos. Vamos processar os 200 MT de taxa de deslocação.</p>
            </div>
          </div>

          <div className="mt-auto border-t pt-4">
            <div className="flex gap-4 mb-2">
              <button className="text-sm font-bold text-blue-600 border-b-2 border-blue-600 pb-1">Responder</button>
              <button className="text-sm font-bold text-gray-400 hover:text-yellow-600 pb-1">Nota Interna</button>
            </div>
            <textarea className="w-full p-3 border rounded-lg bg-gray-50 focus:ring focus:ring-blue-200 mb-2" rows={4} placeholder="Escreva a resposta ao utilizador (pressione / para macros)..."></textarea>
            <div className="flex justify-end">
              <button className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold">Enviar</button>
            </div>
          </div>
        </main>

        {/* Context Panel (Related Entities) */}
        <aside className="w-80 bg-gray-50 border-l p-6 overflow-y-auto">
          <h3 className="font-bold text-gray-900 mb-4">Contexto do Ticket</h3>
          
          <div className="bg-white border p-4 rounded-xl mb-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Utilizador</h4>
            <p className="font-bold">João Maria (Mestre)</p>
            <p className="text-sm text-gray-500">Saldo: 4,500.00 MT</p>
            <p className="text-sm text-green-600 font-semibold mb-3">✓ Identidade Verificada</p>
            <a href="#" className="text-blue-600 text-sm hover:underline">Ver Perfil Completo</a>
          </div>

          <div className="bg-white border p-4 rounded-xl">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Acções Rápidas</h4>
            <button className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1">💸 Pedir Ajuste de Saldo</button>
            <button className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1">🚫 Suspender Utilizador</button>
            <button className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-100 rounded">👁️ Ver Como Utilizador</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
