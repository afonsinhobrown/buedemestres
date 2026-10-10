import { PageShell } from '@/components/layout/PageShell'
import Link from 'next/link'

export const metadata = {
  title: 'Meus Trabalhos | Cliente',
}

export default function ClientJobsPage() {
  const activeJobs: any[] = []
  const pastJobs: any[] = []

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Meus Trabalhos</h1>
          <p className="text-[var(--color-zinco)] mt-1">Trabalhos em curso e histórico.</p>
        </header>
        
        {activeJobs.length === 0 && pastJobs.length === 0 && (
          <div className="text-center py-12 text-[var(--color-zinco)]">
            Ainda não tem trabalhos registados.
          </div>
        )}
      </div>
    </PageShell>
  )
}
