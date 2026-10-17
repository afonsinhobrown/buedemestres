import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import {
  getPlatformSettings,
  getRevenueSummary,
  listPartners,
} from '@/lib/platform-withdrawals'
import {
  approvePlatformWithdrawalAction,
  createPlatformWithdrawalAction,
  linkPartnerProfileAction,
  updatePartnerAccountAction,
  updatePlatformSettingsAction,
} from './actions'

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending_approval: { label: 'Por aprovação', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    processing: { label: 'Em processamento', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed: { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    failed: { label: 'Falhou', className: 'bg-red-50 text-red-700 border-red-200' },
    cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  }
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600 border-gray-200' }
}

export default async function SociosPage() {
  const session = await verifySession()
  if (session.role !== 'superadmin') redirect('/entrar')

  const [partners, settings, summary, profilesRes, withdrawalsRes] = await Promise.all([
    listPartners(),
    getPlatformSettings(),
    getRevenueSummary(),
    db.query<{ id: string; full_name: string; email: string | null; role: string }>(
      `select id, full_name, email, role from profiles order by full_name asc limit 300`
    ),
    db.query(
      `select w.*,
              coalesce((
                select json_agg(json_build_object(
                  'partner_id', a.partner_id,
                  'approved_by', a.approved_by,
                  'approved_at', a.approved_at
                ))
                from platform_withdrawal_approvals a where a.withdrawal_id = w.id
              ), '[]'::json) as approvals
         from platform_withdrawals w
        order by w.created_at desc
        limit 20`
    ),
  ])

  const withdrawals = withdrawalsRes.rows as any[]
  const withdrawalIds = withdrawals.map((w) => w.id)
  const payoutsRes = withdrawalIds.length
    ? await db.query(`select * from partner_payouts where withdrawal_id = any($1::uuid[])`, [withdrawalIds])
    : { rows: [] as any[] }
  const payouts = payoutsRes.rows as any[]

  const currentPartner = partners.find((p) => p.profile_id === session.userId) || null

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sócios</h1>
        <p className="text-gray-500">
          Contas bancárias dos sócios, distribuição das receitas e modo de aprovação. As quotas 40/60 são fixas na base de dados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Receita total</p>
          <p className="text-2xl font-black text-gray-900">{money(summary.total)} MT</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Já distribuída</p>
          <p className="text-2xl font-black text-blue-700">{money(summary.consumed)} MT</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Disponível</p>
          <p className="text-2xl font-black text-emerald-700">{money(summary.available)} MT</p>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Regra de distribuição da plataforma</h2>
        <p className="text-xs text-gray-500 mb-4">
          Define quanto da receita disponível é distribuída aos sócios e quanto fica retido no sistema. Tem de somar 100%.
        </p>
        <form action={updatePlatformSettingsAction} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">% SAQUE</label>
            <input
              type="number"
              name="withdrawPct"
              min="0"
              max="100"
              step="0.01"
              defaultValue={Number((settings.withdrawPct * 100).toFixed(2))}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">% RETIDA</label>
            <input
              type="number"
              name="retainPct"
              min="0"
              max="100"
              step="0.01"
              defaultValue={Number((settings.retainPct * 100).toFixed(2))}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">MODO DE APROVAÇÃO</label>
            <select
              name="approvalRequired"
              defaultValue={settings.approvalRequired ? 'true' : 'false'}
              className="w-full border border-gray-300 rounded-lg p-3"
            >
              <option value="true">ON — aprovação de ambos os sócios</option>
              <option value="false">OFF — automático</option>
            </select>
          </div>
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-3 font-bold hover:bg-black">
            Guardar regra
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3">
          {settings.approvalRequired
            ? 'Os saques da plataforma só saem depois de Afonso e RFL aprovarem (contas ligadas abaixo).'
            : 'Os saques da plataforma são processados automaticamente após o pedido.'}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Sócios</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {partners.map((partner) => (
            <div key={partner.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xl font-black text-gray-900">{partner.name}</p>
                  <p className="text-xs text-gray-500">{partner.email || 'Email de aprovação por definir'}</p>
                </div>
                <span className="bg-gray-900 text-white text-sm font-black px-3 py-1 rounded-full">
                  {Number(partner.share_pct) * 100}%
                </span>
              </div>

              <form action={updatePartnerAccountAction} className="space-y-3">
                <input type="hidden" name="partnerId" value={partner.id} />
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">MÉTODO</label>
                  <select name="method" defaultValue={partner.method} className="w-full border border-gray-300 rounded-lg p-2.5">
                    <option value="bank_transfer">Transferência bancária</option>
                    <option value="emola">e-Mola</option>
                    <option value="mpesa">M-Pesa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">TITULAR</label>
                  <input name="accountName" defaultValue={partner.account_name || ''} className="w-full border border-gray-300 rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">NÚMERO (e-Mola/M-Pesa)</label>
                  <input name="msisdn" defaultValue={partner.msisdn || ''} className="w-full border border-gray-300 rounded-lg p-2.5" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">BANCO</label>
                    <input name="bankName" defaultValue={partner.bank_name || ''} className="w-full border border-gray-300 rounded-lg p-2.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">CONTA / NIB (21)</label>
                    <input name="accountNumber" defaultValue={partner.account_number || ''} className="w-full border border-gray-300 rounded-lg p-2.5" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-bold hover:bg-black">
                  Guardar dados bancários
                </button>
              </form>

              <form action={linkPartnerProfileAction} className="mt-4 pt-4 border-t border-gray-100">
                <input type="hidden" name="partnerId" value={partner.id} />
                <label className="block text-xs font-bold text-gray-600 mb-1">CONTA DE APROVAÇÃO</label>
                <div className="flex gap-2">
                  <select name="profileId" defaultValue={partner.profile_id || ''} className="flex-1 border border-gray-300 rounded-lg p-2.5">
                    <option value="">— por ligar —</option>
                    {profilesRes.rows.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.email || p.role})
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 font-bold hover:bg-blue-700">
                    Ligar
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Distribuições da plataforma</h2>
            <p className="text-xs text-gray-500">Afonso 40% · RFL 60% (fixo)</p>
          </div>
          <form action={createPlatformWithdrawalAction}>
            <button
              type="submit"
              disabled={summary.available <= 0}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              Distribuir {money(summary.available)} MT
            </button>
          </form>
        </div>

        {withdrawals.length === 0 ? (
          <p className="p-8 text-center text-gray-400">Ainda não há distribuições.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {withdrawals.map((w) => {
              const st = statusLabel(w.status)
              const approvals: any[] = Array.isArray(w.approvals) ? w.approvals : []
              const approvedPartners = new Set(approvals.map((a) => a.partner_id))
              const alreadyApproved = approvals.some((a) => a.approved_by === session.userId)
              const canApprove =
                w.status === 'pending_approval' &&
                currentPartner &&
                !approvedPartners.has(currentPartner.id) &&
                !alreadyApproved
              const wPayouts = payouts.filter((p) => p.withdrawal_id === w.id)
              return (
                <div key={w.id} className="p-5">
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div>
                      <p className="font-bold text-gray-900">
                        {money(w.distributed_amount)} MT distribuídos · {money(w.retained_amount)} MT retidos
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Receita {money(w.available_revenue)} MT · saque {Number(w.withdraw_pct) * 100}% · retenção{' '}
                        {Number(w.retain_pct) * 100}% · {new Date(w.created_at).toLocaleString('pt-MZ')}
                      </p>
                      {w.failure_reason ? <p className="text-xs text-red-600 mt-1">{w.failure_reason}</p> : null}
                    </div>
                    <span className={`text-xs font-black border px-3 py-1 rounded-full ${st.className}`}>{st.label}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {partners.map((p) => (
                      <span
                        key={p.id}
                        className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          approvedPartners.has(p.id)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        {approvedPartners.has(p.id) ? '✓ ' : '• '}
                        {p.name}
                      </span>
                    ))}
                  </div>

                  {wPayouts.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {wPayouts.map((p) => {
                        const partner = partners.find((x) => x.id === p.partner_id)
                        return (
                          <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                            <span className="font-bold text-gray-900">{partner?.name || p.partner_id}</span>{' '}
                            · {money(p.amount)} MT
                            <span className="text-xs text-gray-500"> · {p.status}</span>
                            {p.provider_ref ? (
                              <span className="block text-[11px] text-gray-400 font-mono">{p.provider_ref}</span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {canApprove && (
                    <form action={approvePlatformWithdrawalAction} className="mt-4">
                      <input type="hidden" name="withdrawalId" value={w.id} />
                      <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700">
                        Aprovar como {currentPartner?.name}
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
