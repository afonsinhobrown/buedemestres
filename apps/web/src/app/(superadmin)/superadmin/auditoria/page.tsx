import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function AuditoriaPage() {
  const session = await verifySession()
  if (session.role !== 'superadmin' && session.role !== 'admin') redirect('/entrar')

  const logsRes = await db.query(`
    SELECT 
      a.id, a.action, a.entity, a.entity_id, a.ip, a.created_at,
      p.full_name as actor_name
    FROM audit_logs a
    JOIN profiles p ON p.id = a.actor_id
    ORDER BY a.created_at DESC
    LIMIT 100
  `)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Logs de Auditoria</h1>
          <p className="text-gray-500">Histórico de ações críticas da equipa. Apenas os últimos 100 registos são exibidos aqui.</p>
        </div>
        <button className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold">
          Exportar (CSV)
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-semibold text-gray-700">Data</th>
              <th className="p-4 font-semibold text-gray-700">Ator</th>
              <th className="p-4 font-semibold text-gray-700">Ação</th>
              <th className="p-4 font-semibold text-gray-700">Entidade</th>
              <th className="p-4 font-semibold text-gray-700">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logsRes.rows.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="p-4 text-gray-600 font-mono text-xs">
                  {new Date(log.created_at).toLocaleString('pt-MZ')}
                </td>
                <td className="p-4 font-bold text-gray-900">{log.actor_name}</td>
                <td className="p-4">
                  <span className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                    {log.action}
                  </span>
                </td>
                <td className="p-4 text-gray-700 font-mono text-xs">
                  {log.entity} <br/> <span className="text-gray-400">{log.entity_id}</span>
                </td>
                <td className="p-4 text-gray-500 font-mono text-xs">{log.ip || 'N/A'}</td>
              </tr>
            ))}
            {logsRes.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">Nenhum registo encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
