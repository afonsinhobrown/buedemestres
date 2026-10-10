import { PageShell } from '@/components/layout/PageShell'
import ClientCaller from './ClientCaller'

export const metadata = {
  title: 'Chamar Serviço | Bué de Mestres'
}

export default function ChamarPage() {
  return (
    <PageShell>
      <div className="max-w-xl mx-auto p-4 md:p-8">
        <ClientCaller />
      </div>
    </PageShell>
  )
}
