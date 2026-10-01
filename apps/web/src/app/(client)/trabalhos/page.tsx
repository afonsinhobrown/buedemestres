import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatMT } from '@/lib/utils/format-mzn'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Star, CheckCircle, WarningCircle, Handshake } from '@phosphor-icons/react/dist/ssr'
import { JobStatusButtons } from './JobStatusButtons'

export default async function ClientJobsPage() {
  const session = await verifySession()
  
  let jobs: any[] = []
  if (session?.userId) {
    const { rows } = await db.query(
      `SELECT j.*, p.business_name, r.title as request_title,
              (SELECT count(*) FROM reviews rev WHERE rev.job_id = j.id) as has_review
       FROM jobs j
       JOIN provider_profiles p ON j.provider_id = p.profile_id
       LEFT JOIN service_requests r ON j.request_id = r.id
       WHERE j.client_id = $1
       ORDER BY j.created_at DESC`,
      [session.userId]
    )
    jobs = rows
  }

  // Fallback demo caso não esteja autenticado para vermos a UI
  if (!session?.userId) {
    jobs = [
      { id: '1', request_title: 'Motor não liga', business_name: 'Oficina Mabunda', agreed_amount: 1500, status: 'scheduled', created_at: new Date().toISOString(), has_review: 0 },
      { id: '2', request_title: 'Fuga de água na cozinha', business_name: 'Mestre Joaquim', agreed_amount: 800, status: 'completed', created_at: new Date(Date.now() - 86400000).toISOString(), has_review: 0 },
      { id: '3', request_title: 'Pintura da sala', business_name: 'Pinturas Lda', agreed_amount: 5000, status: 'completed', created_at: new Date(Date.now() - 86400000 * 5).toISOString(), has_review: 1 },
    ]
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
        <header className="mb-8">
          <h1 className="text-2xl display-wide">Meus Trabalhos</h1>
          <p className="text-[var(--color-zinco)] text-sm mt-1">Gere os trabalhos combinados com os mestres.</p>
        </header>

        {jobs.length === 0 ? (
          <div className="text-center py-12 bg-[var(--color-papel)] rounded-[var(--radius-placa)] border border-[var(--color-zinco-200)]">
            <p className="text-[var(--color-zinco)]">Ainda não adjudicaste nenhum trabalho.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-[var(--color-papel)] border border-[var(--color-zinco-200)] p-4 rounded-[var(--radius-controlo)]">
                
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-[var(--color-zinco)] uppercase tracking-wider">
                    {new Date(job.created_at).toLocaleDateString('pt-MZ')}
                  </span>
                  <JobStatusBadge status={job.status} />
                </div>
                
                <h3 className="font-bold text-lg text-[var(--color-tinta)] mb-1">{job.request_title || 'Serviço Directo'}</h3>
                <p className="text-sm text-[var(--color-zinco)] mb-4">Com {job.business_name}</p>
                
                <div className="flex justify-between items-center pt-4 border-t border-[var(--color-zinco-200)]">
                  <div className="font-bold text-[var(--color-cobalto)]">
                    {job.agreed_amount ? formatMT(job.agreed_amount) : 'Valor a combinar no local'}
                  </div>
                  
                  <div className="flex gap-2">
                    {job.status === 'scheduled' || job.status === 'in_progress' ? (
                      <JobStatusButtons jobId={job.id} currentStatus={job.status} />
                    ) : null}

                    {job.status === 'completed' && job.has_review == 0 && (
                      <Button size="sm" className="bg-[var(--color-amarelo)] text-[var(--color-tinta)] hover:bg-[var(--color-amarelo)]/90 border border-[var(--color-tinta)]" asChild>
                        <Link href={`/trabalhos/${job.id}/avaliar`}>
                          <Star size={16} weight="fill" className="mr-1" /> Avaliar
                        </Link>
                      </Button>
                    )}

                    {job.status === 'completed' && job.has_review > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-zinco)] px-3 py-1 bg-[var(--color-cal)] rounded-full border border-[var(--color-zinco-200)]">
                        <CheckCircle size={14} weight="bold" /> Avaliado
                      </span>
                    )}
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
