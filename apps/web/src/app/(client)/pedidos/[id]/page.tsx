import { PageShell } from '@/components/layout/PageShell'
import Link from 'next/link'

export default function PedidoPage({ params }: { params: { id: string } }) {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto p-4 md:p-8 text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Detalhes do Pedido</h1>
        <p className="text-[var(--color-zinco)]">O sistema de mensagens real está a ser desenvolvido.</p>
        <Link href="/pedidos" className="text-blue-600 hover:underline mt-4 inline-block">Voltar aos pedidos</Link>
      </div>
    </PageShell>
  )
}
