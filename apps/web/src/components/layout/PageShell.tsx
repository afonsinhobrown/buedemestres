import React from 'react'
import { BottomNav } from './BottomNav'

interface PageShellProps {
  children: React.ReactNode
  noNav?: boolean
}

export function PageShell({ children, noNav = false }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-cal)]">
      {/* Desktop Header placeholder */}
      <header className="hidden md:flex h-16 bg-[var(--color-papel)] border-b border-[var(--color-zinco-200)] px-6 items-center justify-between sticky top-0 z-40">
        <div className="font-bold display-wide text-[var(--color-cobalto)]">BUÉ DE MESTRES</div>
        <nav className="flex gap-6 text-sm font-medium">
          <a href="/pesquisar" className="hover:text-[var(--color-cobalto)]">Procurar</a>
          <a href="/pedidos" className="hover:text-[var(--color-cobalto)]">Pedidos</a>
          <a href="/painel" className="hover:text-[var(--color-cobalto)]">Conta</a>
        </nav>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-[1200px] mx-auto">
        {children}
      </main>

      {!noNav && <BottomNav />}
    </div>
  )
}
