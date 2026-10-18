import { PageShell } from '@/components/layout/PageShell'
import JobTracker from './JobTracker'

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <header className="mb-4 text-center">
          <h1 className="text-3xl font-bold">Estado do Pedido</h1>
        </header>
        
        <JobTracker jobId={id} />
      </div>
    </PageShell>
  )
}
