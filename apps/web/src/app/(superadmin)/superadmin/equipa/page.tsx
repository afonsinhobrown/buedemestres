import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { VoltarDashboard } from '@/components/layout/VoltarDashboard'
import { MembroAcoes, NovoMembroForm } from './EquipaClient'

export default async function EquipaPage() {
  const session = await verifySession()
  if (session.role !== 'superadmin') redirect('/entrar')

  const teamRes = await db.query(`
    SELECT 
      s.profile_id, s.staff_role, s.is_active, s.mfa_required, s.last_login_at,
      p.full_name, p.email
    FROM staff_profiles s
    JOIN profiles p ON p.id = s.profile_id
    ORDER BY s.created_at ASC
  `)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Toaster position="top-right" richColors />
      <div className="mb-4"><VoltarDashboard /></div>

      <div className="mb-8 flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestão de Equipa</h1>
          <p className="text-gray-500">Cria e gere contas de apoio, moderação, financeiro e administração.</p>
        </div>
        <NovoMembroForm />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-semibold text-gray-700">Membro</th>
              <th className="p-4 font-semibold text-gray-700">Papel</th>
              <th className="p-4 font-semibold text-gray-700">MFA</th>
              <th className="p-4 font-semibold text-gray-700">Estado</th>
              <th className="p-4 font-semibold text-gray-700">Último Login</th>
              <th className="p-4 font-semibold text-gray-700 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teamRes.rows.map(member => (
              <tr key={member.profile_id} className="hover:bg-gray-50">
                <td className="p-4">
                  <p className="font-bold text-gray-900">{member.full_name}</p>
                  <p className="text-gray-500 text-xs">{member.email}</p>
                </td>
                <td className="p-4">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold uppercase">
                    {member.staff_role}
                  </span>
                </td>
                <td className="p-4">
                  {member.mfa_required ? (
                    <span className="text-green-600 font-bold">Ativo</span>
                  ) : (
                    <span className="text-red-500 font-bold">Inativo</span>
                  )}
                </td>
                <td className="p-4">
                  {member.is_active ? (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Ativo</span>
                  ) : (
                    <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-bold">Suspenso</span>
                  )}
                </td>
                <td className="p-4 text-gray-500 text-xs">
                  {member.last_login_at ? new Date(member.last_login_at).toLocaleString('pt-MZ') : 'Nunca'}
                </td>
                <td className="p-4 text-right">
                  <MembroAcoes profileId={member.profile_id} isActive={member.is_active} />
                </td>
              </tr>
            ))}
            {teamRes.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Ainda não há membros de equipa. Cria o primeiro com o botão acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
