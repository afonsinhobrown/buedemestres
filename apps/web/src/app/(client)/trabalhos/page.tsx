import Link from 'next/link'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em curso',
  awaiting_confirmation: 'À espera de confirmação',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  disputed: 'Em disputa',
}

type ClientJob = {
  id: string
  request_id: string | null
  status: string
  agreed_amount: string | number | null
  scheduled_at: string | Date | null
  created_at: string | Date
  provider_name: string
  provider_slug: string | null
  category_name: string | null
  payment_status: string | null
}

export default async function ClientJobsPage() {
  const session = await getOptionalSession()

  if (!session?.userId) {
    return (
      <main className="shell" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <h1 className="h1">Os meus trabalhos</h1>
        <p className="mut" style={{ marginTop: 12 }}>
          Entra na conta do cliente para veres os teus pedidos, o estado do pagamento e a localização do mestre.
        </p>
        <Link href="/entrar?redirect=/trabalhos" className="btn b1" style={{ marginTop: 20 }}>
          Entrar na conta do cliente
        </Link>
      </main>
    )
  }

  const res = await db.query<ClientJob>(
    `SELECT j.id, j.request_id, j.status, j.agreed_amount, j.scheduled_at, j.created_at,
            pp.business_name as provider_name, pp.slug as provider_slug,
            c.name as category_name, jp.status as payment_status
       FROM jobs j
       JOIN provider_profiles pp ON pp.profile_id = j.provider_id
       LEFT JOIN categories c ON c.id = (SELECT primary_category_id FROM provider_profiles WHERE profile_id = j.provider_id)
       LEFT JOIN job_payments jp ON jp.job_id = j.id
      WHERE j.client_id = $1
      ORDER BY j.created_at DESC
      LIMIT 50`,
    [session.userId]
  )

  const jobs = res.rows

  return (
    <main className="shell" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <AutoRefresh intervalMs={5000} />
      <h1 className="h1">Os meus trabalhos</h1>
      <p className="mut" style={{ marginTop: 8 }}>
        Acompanha o estado de cada serviço e confirma o pagamento quando o mestre terminar.
      </p>

      {jobs.length === 0 ? (
        <div className="home-map-empty" style={{ marginTop: 28, height: 180 }}>
          <strong>Ainda não tens trabalhos.</strong>
          <Link href="/resultados">Procurar um mestre</Link>
        </div>
      ) : (
        <div className="service-list" style={{ marginTop: 24 }}>
          {jobs.map((job) => (
            <Link
              href={`/pedidos/${job.id}`}
              key={job.id}
              className="service-row"
              style={{ alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <strong>{job.category_name || 'Serviço'} · {job.provider_name}</strong>
                <p className="mut">
                  {STATUS_LABELS[job.status] || job.status}
                  {job.payment_status ? ` · pagamento: ${job.payment_status}` : ''}
                </p>
                <p className="mut">
                  {job.scheduled_at
                    ? `Agendado para ${new Date(job.scheduled_at).toLocaleString('pt-MZ')}`
                    : `Criado em ${new Date(job.created_at).toLocaleDateString('pt-MZ')}`}
                </p>
                {job.provider_slug && (
                  <span className="mut">Perfil do mestre: {job.provider_slug}</span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                {job.agreed_amount != null && (
                  <b>{new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 }).format(Number(job.agreed_amount))} MT</b>
                )}
                <div className="btn b1 s" style={{ marginTop: 8 }}>Ver acompanhamento</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
