import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatMT } from '@/lib/utils/format-mzn'
import { CheckCircle, WarningCircle, Handshake, MapPin } from '@phosphor-icons/react/dist/ssr'
import { JobStatusButtons } from '@/app/(client)/trabalhos/JobStatusButtons'

export default async function ProviderJobsPage() {
  const session = await verifySession()
  
  let jobs: any[] = []
  if (session?.userId) {
    const { rows } = await db.query(
      `SELECT j.*, p.full_name as client_name, r.title as request_title, r.district_id,
              d.name as district_name
       FROM jobs j
       JOIN profiles p ON j.client_id = p.id
       LEFT JOIN service_requests r ON j.request_id = r.id
       LEFT JOIN districts d ON r.district_id = d.id
       WHERE j.provider_id = $1
       ORDER BY j.created_at DESC`,
      [session.userId]
    )
    jobs = rows
  }

  // Fallback demo caso não esteja autenticado para vermos a UI
  if (!session?.userId) {
    jobs = [
      { id: '1', request_title: 'Motor não liga', client_name: 'António Cuamba', district_name: 'Polana', agreed_amount: 1500, status: 'scheduled', created_at: new Date().toISOString() },
      { id: '2', request_title: 'Mudar pastilhas travão', client_name: 'Maria José', district_name: 'Matola', agreed_amount: null, status: 'completed', created_at: new Date(Date.now() - 86400000).toISOString() },
    ]
  }

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
        <header className="mb-8">
          <h1 className="text-2xl display-wide">Agenda de Trabalhos</h1>
          <p className="text-[var(--color-zinco)] text-sm mt-1">Os teus serviços adjudicados.</p>
        </header>

        {jobs.length === 0 ? (
          <div className="text-center py-12 bg-[var(--color-papel)] rounded-[var(--radius-placa)] border border-[var(--color-zinco-200)]">
            <p className="text-[var(--color-zinco)]">Ainda não tens trabalhos agendados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-[var(--color-papel)] border border-[var(--color-zinco-200)] p-4 md:p-6 rounded-[var(--radius-controlo)]">
                
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-[var(--color-zinco)] uppercase tracking-wider">
                    {new Date(job.created_at).toLocaleDateString('pt-MZ')}
                  </span>
                  <JobStatusBadge status={job.status} />
                </div>
                
                <h3 className="font-bold text-lg md:text-xl text-[var(--color-tinta)] mb-2">{job.request_title || 'Serviço Directo'}</h3>
                
                <div className="flex flex-col gap-1 mb-4 text-sm text-[var(--color-tinta)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Cliente:</span> {job.client_name}
                  </div>
                  {job.district_name && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[var(--color-zinco)]" /> {job.district_name}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-[var(--color-zinco-200)] gap-4">
                  <div className="font-bold text-[var(--color-cobalto)] text-lg">
                    {job.agreed_amount ? formatMT(job.agreed_amount) : 'Valor não definido (Avaliar no local)'}
                  </div>
                  
                  <div className="flex gap-2">
                    {/* O provider também pode marcar como concluído */}
                    {job.status === 'scheduled' || job.status === 'in_progress' ? (
                      <JobStatusButtons jobId={job.id} currentStatus={job.status} />
                    ) : null}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'scheduled':
      return <span className="text-[10px] font-bold px-2 py-1 bg-[var(--color-amarelo)]/20 text-[var(--color-tinta)] border border-[var(--color-amarelo)] rounded-sm flex items-center gap-1"><Handshake size={12} weight="bold" /> Agendado</span>
    case 'in_progress':
      return <span className="text-[10px] font-bold px-2 py-1 bg-[var(--color-cobalto)]/10 text-[var(--color-cobalto)] border border-[var(--color-cobalto)]/30 rounded-sm">Em curso</span>
    case 'completed':
      return <span className="text-[10px] font-bold px-2 py-1 bg-[#1E7F4F]/10 text-[#1E7F4F] border border-[#1E7F4F]/30 rounded-sm flex items-center gap-1"><CheckCircle size={12} weight="bold" /> Concluído</span>
    case 'cancelled':
    case 'disputed':
      return <span className="text-[10px] font-bold px-2 py-1 bg-[var(--color-oxido)]/10 text-[var(--color-oxido)] border border-[var(--color-oxido)]/30 rounded-sm flex items-center gap-1"><WarningCircle size={12} weight="bold" /> {status === 'cancelled' ? 'Cancelado' : 'Disputa'}</span>
    default:
      return null
  }
}
