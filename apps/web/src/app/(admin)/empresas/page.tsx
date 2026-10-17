import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { EmpresaAcoes } from './EmpresaAcoes'

export default async function EmpresasAdminPage() {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role || '')) redirect('/entrar')

  const { rows } = await db.query<{
    id: string
    legal_name: string
    trade_name: string
    nuit: string
    email: string | null
    phone: string | null
    status: string
    verification: string
    owner_name: string
    masters: string
    documents: string
  }>(
    `select c.id, c.legal_name, c.trade_name, c.nuit, c.email, c.phone, c.status, c.verification,
            p.full_name as owner_name,
            (select count(*)::text from company_masters cm where cm.company_id = c.id) as masters,
            (select count(*)::text from company_documents cd where cd.company_id = c.id) as documents
       from companies c
       join profiles p on p.id = c.owner_id
      order by c.created_at desc`
  )

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Empresas</h1>
        <p className="text-gray-500">Verifica documentos e aprova empresas prestadoras de serviços.</p>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Sem empresas registadas.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4">Empresa</th>
                <th className="p-4">NUIT</th>
                <th className="p-4">Responsável</th>
                <th className="p-4">Mestres</th>
                <th className="p-4">Docs</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{company.trade_name}</p>
                    <p className="text-xs text-gray-500">{company.legal_name}</p>
                  </td>
                  <td className="p-4 font-mono">{company.nuit}</td>
                  <td className="p-4">{company.owner_name}</td>
                  <td className="p-4">{company.masters}</td>
                  <td className="p-4">{company.documents}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      company.verification === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : company.verification === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {company.verification}
                    </span>
                  </td>
                  <td className="p-4">
                    <EmpresaAcoes companyId={company.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
