import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { approvePayoutAction, rejectPayoutAction, togglePayoutApproval } from './actions'

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function methodLabel(method: string, msisdn: string | null, bank: string | null, account: string | null) {
  if (method === 'emola') return `e-Mola · ${msisdn || '—'}`
  if (method === 'mpesa') return `M-Pesa · ${msisdn || '—'}`
  if (method === 'bank_transfer') return `${bank || 'Banco'} · ${account || '—'}`
  return method
}

export default async function PagamentosAprovacaoPage() {
  const session = await verifySession()
  if (!['superadmin', 'finance'].includes(session.role || '')) redirect('/entrar')

  const [{ rows: settingRows }, { rows: payoutRows }] = await Promise.all([
    db.query<{ value: unknown }>(`select value from app_settings where key = 'payout_require_approval' limit 1`),
    db.query(
      `select p.id, p.amount, p.method, p.msisdn, p.account_name, p.bank_name, p.account_number,
              p.status, p.created_at, pr.full_name as provider_name, pr.email as provider_email
         from payouts p
         join profiles pr on pr.id = p.provider_id
        where p.status in ('pending', 'processing')
        order by p.created_at asc`
    ),
  ])

  const requireApproval = settingRows[0]?.value === true || String(settingRows[0]?.value) === 'true'
  const pending = payoutRows.filter((p) => p.status === 'pending')
  const processing = payoutRows.filter((p) => p.status === 'processing')

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pagamentos por Aprovação</h1>
        <p className="text-gray-500">
          Controla se os saques dos mestres são enviados automaticamente pelo sistema ou apenas após aprovação da equipa.
        </p>
      </div>

      <div className={`rounded-2xl border p-6 mb-8 shadow-sm ${requireApproval ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Estado actual</p>
            <p className={`text-xl font-black ${requireApproval ? 'text-amber-700' : 'text-emerald-700'}`}>
              {requireApproval ? 'ON — pagamentos por aprovação' : 'OFF — pagamento automático pelo sistema'}
            </p>
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              {requireApproval
                ? 'Os pedidos ficam pendentes até a equipa aprovar. Ao aprovar, o sistema envia o valor para os dados do mestre.'
                : 'O mestre pede e o sistema paga automaticamente (via PaySuite), sem intervenção humana.'}
            </p>
          </div>
          <form action={togglePayoutApproval}>
            <input type="hidden" name="enabled" value={requireApproval ? 'false' : 'true'} />
            <button
              type="submit"
              className={`px-6 py-3 rounded-xl font-black text-sm shadow-sm transition-colors ${
                requireApproval
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {requireApproval ? 'Desativar (pagar automaticamente)' : 'Ativar (exigir aprovação)'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Pedidos pendentes</h2>
          <span className="text-sm font-semibold text-gray-500">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="p-8 text-center text-gray-400">Sem pedidos à espera de aprovação.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((p) => (
              <div key={p.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-gray-900">{p.provider_name || 'Mestre'}</p>
                  <p className="text-xs text-gray-500">{p.provider_email || '—'}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {methodLabel(p.method, p.msisdn, p.bank_name, p.account_number)}
                    {p.account_name ? ` · titular: ${p.account_name}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Pedido em {new Date(p.created_at).toLocaleString('pt-MZ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-900">{money(p.amount)} MT</p>
                </div>
                <div className="flex gap-2">
                  <form action={approvePayoutAction}>
                    <input type="hidden" name="payoutId" value={p.id} />
                    <button
                      type="submit"
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700"
                    >
                      Aprovar e pagar
                    </button>
                  </form>
                  <form action={rejectPayoutAction}>
                    <input type="hidden" name="payoutId" value={p.id} />
                    <button
                      type="submit"
                      className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100"
                    >
                      Rejeitar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {processing.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Em processamento</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {processing.map((p) => (
              <div key={p.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-900">{p.provider_name || 'Mestre'}</p>
                  <p className="text-sm text-gray-600">{methodLabel(p.method, p.msisdn, p.bank_name, p.account_number)}</p>
                </div>
                <p className="text-lg font-black text-amber-600">{money(p.amount)} MT</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
