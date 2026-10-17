import React from 'react';
import Link from 'next/link';

const NAV = [
  { href: '/superadmin', label: 'Dashboard' },
  { href: '/superadmin/financeiro', label: 'Financeiro' },
  { href: '/superadmin/pagamentos-aprovacao', label: 'Pagamentos por Aprovação' },
  { href: '/superadmin/socios', label: 'Sócios' },
  { href: '/superadmin/promocoes', label: 'Promoções' },
  { href: '/superadmin/equipa', label: 'Equipa' },
  { href: '/superadmin/aprovacoes', label: 'Aprovações' },
  { href: '/superadmin/auditoria', label: 'Auditoria' },
  { href: '/configuracoes', label: 'Configurações' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/tickets', label: 'Tickets / Apoio' },
];

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#8B0000] text-white px-4 py-2 flex justify-between items-center text-xs sm:text-sm font-bold shadow-md relative z-10">
        <span>⚠️ MODO SUPERADMIN — Acesso Nível 5</span>
        <span className="hidden sm:inline">Bué de Mestres · Gestão</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex w-64 bg-gray-900 text-gray-300 flex-col shrink-0">
          <div className="p-6 font-bold text-white text-xl border-b border-gray-800">
            Bué de Mestres
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="block p-3 hover:bg-gray-800 rounded text-sm">
                {item.label}
              </a>
            ))}
            <Link href="/pro/perfil" className="block p-3 hover:bg-gray-800 rounded text-sm text-yellow-500 font-medium">
              Ver Como Utilizador
            </Link>
          </nav>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <nav className="md:hidden flex gap-2 overflow-x-auto bg-gray-900 text-gray-200 px-3 py-2">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-gray-800 text-xs font-semibold">
                {item.label}
              </a>
            ))}
          </nav>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
