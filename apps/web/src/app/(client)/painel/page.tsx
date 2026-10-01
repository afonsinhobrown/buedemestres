import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { logoutAction } from '@/app/actions/auth'
import type { Profile, Wallet } from '@/types/database'

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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <h1 className="text-lg font-bold text-orange-500">Bué de Mestres</h1>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sair
          </button>
        </form>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Boas-vindas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Bem-vindo,</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">{profile?.full_name}</h2>
          <p className="text-sm text-gray-400 mt-1">{profile?.email}</p>
          {profile?.role === 'client' && (
            <a
              href="/pro/activar"
              className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
              Tornar-me profissional →
            </a>
          )}
        </div>

        {/* Carteira */}
        {wallet && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-500">Saldo da carteira</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {Number(wallet.balance).toLocaleString('pt-MZ', {
                style: 'currency',
                currency: 'MZN',
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        )}

        {/* Código de afiliado */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm font-medium text-gray-700">Seu código de afiliado</p>
          <p className="mt-2 text-xl font-mono font-bold text-orange-500 tracking-widest">
            {profile?.referral_code}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Partilhe e ganhe 10% sobre os carregamentos dos seus referidos durante 90 dias.
          </p>
        </div>
      </div>
    </main>
  )
}
