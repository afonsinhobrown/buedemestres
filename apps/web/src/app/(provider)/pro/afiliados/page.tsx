import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { AfiliadosClient } from './AfiliadosClient'

export default async function AfiliadosPage() {
  const session = await verifySession()

  // Buscar dados do perfil (código de afiliado)
  const profileRes = await db.query(`
    SELECT referral_code FROM profiles WHERE id = $1
  `, [session.userId])
  
  const referralCode = profileRes.rows[0]?.referral_code || null

  // Buscar total de comissões pendentes
  const pendingRes = await db.query(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM affiliate_commissions 
    WHERE referrer_id = $1 AND status = 'pending'
  `, [session.userId])
  const pendingTotal = Number(pendingRes.rows[0]?.total || 0)

  // Buscar total de comissões pagas
  const paidRes = await db.query(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM affiliate_commissions 
    WHERE referrer_id = $1 AND status = 'paid'
  `, [session.userId])
  const paidTotal = Number(paidRes.rows[0]?.total || 0)

  // Buscar histórico de indicações e comissões (opcional, para uma tabela no futuro)
  const historyRes = await db.query(`
    SELECT ac.amount, ac.status, ac.created_at, p.full_name as referred_name
    FROM affiliate_commissions ac
    JOIN profiles p ON p.id = ac.referred_id
    WHERE ac.referrer_id = $1
    ORDER BY ac.created_at DESC
    LIMIT 10
  `, [session.userId])

  return (
    <div className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Programa de Afiliados</h1>
        <p className="text-gray-500">Convide colegas para a plataforma e ganhe comissões sobre os pagamentos deles.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border-l-4 border-blue-500 shadow-sm p-8 rounded-xl">
          <h2 className="text-gray-600 text-lg font-medium mb-2">Comissões Pendentes</h2>
          <p className="text-4xl font-black text-gray-900">{pendingTotal.toFixed(2)} MT</p>
          <p className="text-sm text-gray-400 mt-2">Aguardam liquidação pela equipa admin.</p>
        </div>
        <div className="bg-white border-l-4 border-green-500 shadow-sm p-8 rounded-xl">
          <h2 className="text-gray-600 text-lg font-medium mb-2">Comissões Pagas</h2>
          <p className="text-4xl font-black text-gray-900">{paidTotal.toFixed(2)} MT</p>
          <p className="text-sm text-gray-400 mt-2">Já transferidas para si.</p>
        </div>
      </div>

      <AfiliadosClient referralCode={referralCode} />

      {historyRes.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-lg text-gray-900">Histórico Recente</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-sm text-gray-600 font-semibold">Data</th>
                <th className="p-4 text-sm text-gray-600 font-semibold">Mestre Convidado</th>
                <th className="p-4 text-sm text-gray-600 font-semibold">Comissão</th>
                <th className="p-4 text-sm text-gray-600 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyRes.rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  <td className="p-4 text-gray-700">
                    {new Date(row.created_at).toLocaleDateString('pt-MZ')}
                  </td>
                  <td className="p-4 font-medium text-gray-900">{row.referred_name}</td>
                  <td className="p-4 font-bold text-gray-900">{Number(row.amount).toFixed(2)} MT</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {row.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
