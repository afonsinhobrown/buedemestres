import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatMT } from '@/lib/utils/format-mzn'
import { CheckCircle, WarningCircle, Handshake, MapPin } from '@phosphor-icons/react/dist/ssr'
import { JobStatusButtons } from '@/app/(client)/trabalhos/JobStatusButtons'
import { ProposalForm } from './ProposalForm'

type ProviderJob = {
  id: string
  request_id: string | null
  request_title: string | null
  client_name: string
  district_name: string | null
  agreed_amount: number | string | null
  status: string
  created_at: string
}

type AvailableRequest = {
  id: string
  title: string
  description: string
  address: string | null
  category_name: string
  district_name: string | null
  created_at: string
}

export default async function ProviderJobsPage() {
  const session = await verifySession()
  
  let jobs: ProviderJob[] = []
  if (session?.userId) {
    const { rows } = await db.query<ProviderJob>(
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

  const { rows: availableRequests } = await db.query<AvailableRequest>(
    `select r.id, r.title, r.description, r.address,
            c.name as category_name, d.name as district_name, r.created_at
       from service_requests r
       join categories c on c.id = r.category_id
       left join districts d on d.id = r.district_id
      where r.status in ('open', 'in_negotiation')
        and (r.target_provider_id is null or r.target_provider_id = $1)
        and (
          r.target_provider_id = $1
          or r.category_id = (select primary_category_id from provider_profiles where profile_id = $1)
          or r.category_id in (select category_id from provider_categories where provider_id = $1)
        )
      order by r.created_at desc
      limit 20`,
    [session.userId]
  )

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
        <header className="mb-8">
          <h1 className="text-2xl display-wide">Agenda de Trabalhos</h1>
          <p className="text-[var(--color-zinco)] text-sm mt-1">Os teus serviços adjudicados.</p>
        </header>

        {availableRequests.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-[var(--color-tinta)]">Pedidos disponíveis</h2>
            <div className="space-y-3">
              {availableRequests.map((request) => (
                <div key={request.id} className="rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)] bg-[var(--color-papel)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[var(--color-tinta)]">{request.title}</h3>
                      <p className="mt-1 text-sm text-[var(--color-zinco)]">{request.description}</p>
                      <p className="mt-2 text-xs text-[var(--color-zinco)]">
                        {request.category_name}
                        {request.district_name ? ` · ${request.district_name}` : ''}
                        {request.address ? ` · ${request.address}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--color-zinco)]">
                      {new Date(request.created_at).toLocaleDateString('pt-MZ')}
                    </span>
                  </div>
                  <ProposalForm requestId={request.id} />
                </div>
              ))}
            </div>
          </section>
        )}

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
                    {job.agreed_amount ? formatMT(Number(job.agreed_amount)) : 'Valor não definido (Avaliar no local)'}
                  </div>
                  
                  <div className="flex gap-2">
                    {/* O provider também pode marcar como concluído */}
                    {job.status === 'scheduled' || job.status === 'in_progress' ? (
                      <JobStatusButtons jobId={job.id} />
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
