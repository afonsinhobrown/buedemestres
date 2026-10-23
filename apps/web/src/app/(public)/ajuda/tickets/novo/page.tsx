import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'
import { createTicketAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NovoTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const session = await getOptionalSession()

  if (!session?.userId) {
    redirect('/entrar?redirect=/ajuda/tickets/novo')
  }

  let categories: Array<{ id: number; name: string }> = []
  try {
    const result = await db.query<{ id: number; name: string }>(
      `select id, name from ticket_categories where is_active = true order by sort_order, name`
    )
    categories = result.rows
  } catch (error) {
    console.error('Erro ao carregar categorias de ajuda:', error)
  }

  return (
    <div className="mx-auto mt-12 min-h-screen max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Novo Pedido de Ajuda</h1>
          <p className="text-gray-500">
            Descreve o problema com o máximo de detalhe possível para podermos ser rápidos.
          </p>
        </div>
        <Link href="/ajuda" className="text-sm font-bold text-gray-400 hover:text-gray-600">
          ← Voltar
        </Link>
      </div>

      {erro && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <form action={createTicketAction} className="space-y-6">
        <div>
          <label htmlFor="category_id" className="mb-2 block text-sm font-semibold">
            Categoria
          </label>
          <select
            id="category_id"
            name="category_id"
            required
            defaultValue=""
            className="w-full rounded-xl border bg-gray-50 p-4"
          >
            <option value="" disabled>
              Seleciona uma opção...
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="mb-2 block text-sm font-semibold">
            Assunto Principal
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            minLength={5}
            maxLength={120}
            className="w-full rounded-xl border bg-gray-50 p-4"
            placeholder="Ex: Não recebi o pagamento do trabalho..."
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-semibold">
            Descrição Completa
          </label>
          <textarea
            id="description"
            name="description"
            required
            minLength={10}
            maxLength={5000}
            className="h-40 w-full rounded-xl border bg-gray-50 p-4"
            placeholder="Explica tudo o que aconteceu, com datas e referências se possível."
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white hover:bg-blue-700"
        >
          Enviar Pedido
        </button>
      </form>
    </div>
  )
}
