import React from 'react';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Barra em Vermelho Óxido indicando zona de risco elevado */}
      <div className="bg-[#8B0000] text-white px-6 py-2 flex justify-between items-center text-sm font-bold shadow-md relative z-10">
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span>MODO SUPERADMIN — Acesso Nível 5</span>
        </div>
        <div>
          Sessão Expira em: 03:59:00
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col">
          <div className="p-6 font-bold text-white text-xl border-b border-gray-800">
            Bué de Mestres
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <a href="/superadmin" className="block p-3 hover:bg-gray-800 rounded text-sm">Dashboard</a>
            <a href="/superadmin/equipa" className="block p-3 hover:bg-gray-800 rounded text-sm">Gerir Equipa</a>
            <a href="/superadmin/aprovacoes" className="block p-3 hover:bg-gray-800 rounded text-sm">Aprovações Pendentes</a>
            <a href="/superadmin/auditoria" className="block p-3 hover:bg-gray-800 rounded text-sm">Audit Logs</a>
            <a href="/superadmin/ver-como" className="block p-3 hover:bg-gray-800 rounded text-sm text-yellow-500 font-medium">Ver Como Utilizador</a>
          </nav>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
