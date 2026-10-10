import { PageShell } from '@/components/layout/PageShell'
import JobTracker from './JobTracker'

export default function PedidoPage({ params }: { params: { id: string } }) {
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <header className="mb-4 text-center">
          <h1 className="text-3xl font-bold">Estado do Pedido</h1>
        </header>
        
        <JobTracker jobId={params.id} />
      </div>
    </PageShell>
  )
}
