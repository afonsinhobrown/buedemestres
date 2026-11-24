import type { UserRole } from '@/types/database'

export type RoleLink = {
  href: string
  label: string
}

export function roleLabel(role: UserRole | string | null | undefined): string {
  switch (role) {
    case 'provider':
      return 'Mestre'
    case 'client':
      return 'Cliente'
    case 'superadmin':
      return 'Superadmin'
    case 'admin':
      return 'Admin'
    case 'finance':
      return 'Financeiro'
    case 'support':
      return 'Apoio'
    case 'moderator':
      return 'Moderação'
    default:
      return 'Conta'
  }
}

export function roleLinks(role: UserRole | string | null | undefined): RoleLink[] {
  switch (role) {
    case 'provider':
      return [
        { href: '/pro/trabalhos', label: 'Trabalhos' },
        { href: '/pro/carteira', label: 'Carteira' },
        { href: '/pro/servicos', label: 'Serviços' },
        { href: '/pro/perfil', label: 'Perfil' },
        { href: '/ajuda', label: 'Ajuda' },
      ]
    case 'superadmin':
      return [
        { href: '/superadmin', label: 'Painel' },
        { href: '/tickets', label: 'Tickets' },
        { href: '/superadmin/financeiro', label: 'Financeiro' },
        { href: '/superadmin/socios', label: 'Sócios' },
        { href: '/ajuda', label: 'Ajuda' },
      ]
    case 'admin':
    case 'finance':
    case 'support':
    case 'moderator':
      return [
        { href: '/painel', label: 'Painel' },
        { href: '/tickets', label: 'Tickets' },
        { href: '/pagamentos', label: 'Pagamentos' },
        { href: '/ajuda', label: 'Ajuda' },
      ]
    default:
      return [
        { href: '/trabalhos', label: 'Trabalhos' },
        { href: '/pedidos', label: 'Pedidos' },
        { href: '/chamar', label: 'Chamar agora' },
        { href: '/notificacoes', label: 'Notificações' },
        { href: '/ajuda', label: 'Ajuda' },
      ]
  }
}
