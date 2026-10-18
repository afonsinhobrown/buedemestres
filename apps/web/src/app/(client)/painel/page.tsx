import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { logoutAction } from '@/app/actions/auth'
import { PageShell } from '@/components/layout/PageShell'
import { formatMT } from '@/lib/utils/format-mzn'
import type { Profile, Wallet } from '@/types/database'
import {
  ClipboardText,
  MagnifyingGlass,
  Bell,
  Briefcase,
  SignOut,
  Wallet as WalletIcon,
  Ticket,
} from '@phosphor-icons/react/dist/ssr'

export default async function PainelPage() {
  const session = await verifySession()

  const { rows: profileRows } = await db.query<Profile>(
    `select id, full_name, email, phone, role, referral_code, avatar_url
     from profiles where id = $1`,
    [session.userId]
  )
  const profile = profileRows[0]

  const { rows: walletRows } = await db.query<Wallet>(
    `select balance from wallets where profile_id = $1`,
    [session.userId]
  )
  const wallet = walletRows[0]

  const { rows: orderRows } = await db.query<{ total: string; active: string }>(
    `select count(*)::text as total,
            count(*) filter (where status in ('open', 'accepted', 'in_negotiation', 'in_progress', 'price_proposed', 'puxado'))::text as active
       from service_requests
      where client_id = $1`,
    [session.userId]
  )
  const orders = orderRows[0] ?? { total: '0', active: '0' }

  const isProvider = profile?.role === 'provider'
  const isStaff = ['support', 'moderator', 'finance', 'admin', 'superadmin'].includes(profile?.role ?? '')

  const initials = (profile?.full_name || 'Cliente')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const actions = [
    { href: '/pedidos', label: 'Meus Pedidos', hint: `${orders.total} no total`, icon: ClipboardText },
    { href: '/pesquisar', label: 'Procurar Mestre', hint: 'Encontrar profissionais', icon: MagnifyingGlass },
    { href: '/notificacoes', label: 'Notificações', hint: 'Avisos e atualizações', icon: Bell },
    ...(isProvider
      ? [{ href: '/pro/trabalhos', label: 'Agenda de Trabalhos', hint: 'Serviços atribuídos', icon: Briefcase }]
      : []),
    ...(isStaff
      ? [{ href: '/tickets', label: 'Painel de Apoio', hint: 'Tickets da equipa', icon: Ticket }]
      : []),
  ]

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl display-wide">A minha conta</h1>
            <p className="text-sm text-[var(--color-zinco)] mt-1">
              {profile?.email ?? 'Sem e-mail associado'}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm font-bold text-[var(--color-oxido)] border border-[var(--color-oxido)]/30 px-3 py-2 rounded-[var(--radius-controlo)] hover:bg-[var(--color-oxido)]/10 transition-colors"
            >
              <SignOut size={16} weight="bold" /> Sair
            </button>
          </form>
        </header>

        <section className="bg-[var(--color-papel)] border border-[var(--color-zinco-200)] rounded-[var(--radius-placa)] p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-cobalto)] text-white flex items-center justify-center text-xl font-black">
              {initials || 'C'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-[var(--color-tinta)]">
                {profile?.full_name ?? 'Cliente'}
              </h2>
              <p className="text-sm text-[var(--color-zinco)]">
                {isProvider ? 'Mestre' : isStaff ? 'Equipa Bué de Mestres' : 'Cliente'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-[var(--color-cal)] border border-[var(--color-zinco-200)] rounded-[var(--radius-controlo)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-zinco)] text-xs font-bold uppercase tracking-wider">
                <WalletIcon size={16} weight="bold" /> Carteira
              </div>
              <p className="text-xl font-black text-[var(--color-tinta)] mt-2">
                {formatMT(Number(wallet?.balance ?? 0))}
              </p>
            </div>
            <div className="bg-[var(--color-cal)] border border-[var(--color-zinco-200)] rounded-[var(--radius-controlo)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-zinco)] text-xs font-bold uppercase tracking-wider">
                <ClipboardText size={16} weight="bold" /> Pedidos
              </div>
              <p className="text-xl font-black text-[var(--color-tinta)] mt-2">
                {orders.active} ativos
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[var(--color-papel)] border border-[var(--color-zinco-200)] rounded-[var(--radius-placa)] overflow-hidden mb-6">
          {actions.map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-5 py-4 border-b border-[var(--color-zinco-200)] last:border-b-0 hover:bg-[var(--color-cal)] transition-colors"
            >
              <Icon size={22} weight="bold" className="text-[var(--color-cobalto)]" />
              <span className="flex-1">
                <span className="block font-bold text-[var(--color-tinta)]">{label}</span>
                <span className="block text-xs text-[var(--color-zinco)]">{hint}</span>
              </span>
              <span className="text-[var(--color-zinco)]">→</span>
            </Link>
          ))}
        </section>

        {profile?.referral_code && (
          <section className="bg-[var(--color-papel)] border border-[var(--color-zinco-200)] rounded-[var(--radius-placa)] p-5">
            <p className="text-sm font-bold text-[var(--color-tinta)]">Código de afiliado</p>
            <p className="mt-2 text-xl font-mono font-black text-[var(--color-cobalto)] tracking-widest">
              {profile.referral_code}
            </p>
            <p className="mt-1 text-xs text-[var(--color-zinco)]">
              Partilha e ganha 10% sobre os carregamentos dos teus referidos durante 90 dias.
            </p>
          </section>
        )}
      </div>
    </PageShell>
  )
}
