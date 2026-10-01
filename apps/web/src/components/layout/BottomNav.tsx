'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, MagnifyingGlass, ClipboardText, ChatCircle, User } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Início', icon: House },
    { href: '/pesquisar', label: 'Procurar', icon: MagnifyingGlass },
    { href: '/pedidos', label: 'Pedidos', icon: ClipboardText },
    { href: '/mensagens', label: 'Mensagens', icon: ChatCircle },
    { href: '/painel', label: 'Conta', icon: User },
  ]

  // Não mostrar a navegação nas rotas de admin ou de dev
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/dev')) {
    return null
  }

  return (
    <>
      {/* Spacer para não sobrepor conteúdo (altura fixa 60px) */}
      <div className="h-[60px] w-full shrink-0 md:hidden" />
      
      {/* Barra de navegação fixa */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[60px] w-full items-center justify-around border-t border-[var(--color-zinco-200)] bg-[var(--color-papel)] pb-safe md:hidden">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href))
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1",
                isActive ? "text-[var(--color-cobalto)]" : "text-[var(--color-zinco)] hover:text-[var(--color-tinta)]"
              )}
            >
              <Icon size={24} weight={isActive ? "fill" : "regular"} />
              <span className="text-[10px] font-medium leading-none">{link.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
