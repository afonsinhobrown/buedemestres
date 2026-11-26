import { PageShell } from '@/components/layout/PageShell'
import { ProviderCard } from '@/components/providers/ProviderCard'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Faders, CaretDown } from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'Resultados da pesquisa',
}

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const l = typeof params.l === 'string' ? params.l : 'Polana'

  // Obter resultados reais da base de dados usando a função do PostgreSQL
  const { rows } = await db.query(
    `SELECT * FROM search_providers($1, null, null, null, 0, false, 20, 0)`,
    [q]
  )

  const results = rows.map((row: any) => ({
    slug: row.slug,
    name: row.business_name,
    tradeName: row.headline || 'Profissional',
    tradeCategory: '',
    rating: row.rating_avg ? parseFloat(row.rating_avg) : null,
    reviewCount: row.rating_count || 0,
    neighborhood: l || 'Moçambique',
    distanceKm: undefined,
    minPrice: undefined,
    isVerified: row.verified,
    isFeatured: row.is_featured,
    photoUrl: 'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=400&q=80' // Imagem genérica temporária
  }))

  return (
    <PageShell>
      <div className="flex flex-col md:flex-row h-full min-h-screen">
        
        {/* Barra lateral de filtros (Desktop) e topo (Mobile) */}
        <aside className="w-full md:w-72 bg-[var(--color-papel)] border-b md:border-r border-[var(--color-zinco-200)] p-4 md:p-6 shrink-0 flex flex-col gap-6 md:sticky md:top-16 md:h-[calc(100vh-64px)] overflow-y-auto">
          <form className="space-y-4">
            <h2 className="font-bold text-lg hidden md:block">Pesquisa</h2>
            <div className="flex flex-col gap-4">
              <Input 
                name="q" 
                defaultValue={q} 
                placeholder="Ex: mecânico" 
                className="h-10" 
              />
              <div className="relative">
                <Input 
                  name="l" 
                  defaultValue={l} 
                  placeholder="Local" 
                  className="h-10 pl-9" 
                />
                <MapPin className="absolute left-3 top-2.5 text-[var(--color-zinco)]" size={18} />
              </div>
              <Button type="submit" size="sm" className="hidden md:flex">Actualizar</Button>
            </div>
          </form>

          {/* Filtros Mobile (Chips Horizontais) */}
          <div className="md:hidden flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2">
            <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-[var(--color-zinco-200)] bg-[var(--color-cal)] text-sm font-medium whitespace-nowrap shrink-0">
              <Faders size={16} /> Filtros
            </button>
            <button className="inline-flex items-center gap-1 h-10 px-4 rounded-full border border-[var(--color-zinco-200)] bg-[var(--color-papel)] text-sm font-medium whitespace-nowrap shrink-0">
              Verificados <CaretDown size={12} />
            </button>
            <button className="inline-flex items-center gap-1 h-10 px-4 rounded-full border border-[var(--color-zinco-200)] bg-[var(--color-papel)] text-sm font-medium whitespace-nowrap shrink-0">
              Avaliação 4+
            </button>
          </div>

          <div className="hidden md:block space-y-6">
            <hr className="border-[var(--color-zinco-200)]" />
            <h2 className="font-bold text-lg">Filtros</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded-sm border-[var(--color-zinco)] text-[var(--color-cobalto)] focus:ring-[var(--color-amarelo)]" />
                Apenas verificados
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded-sm border-[var(--color-zinco)] text-[var(--color-cobalto)] focus:ring-[var(--color-amarelo)]" />
                Com preços visíveis
              </label>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-sm text-[var(--color-zinco)]">Avaliação</h3>
              {[4, 3, 2].map((stars) => (
                <label key={stars} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="rating" className="w-4 h-4 text-[var(--color-cobalto)] focus:ring-[var(--color-amarelo)]" />
                  {stars} estrelas ou mais
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Lista de Resultados */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h1 className="text-xl font-bold">
              {results.length} mestres em {l}
            </h1>
            
            {/* Controlo Segmentado de Ordenação */}
            <div className="inline-flex bg-[var(--color-cal)] p-1 rounded-lg border border-[var(--color-zinco-200)] self-start md:self-auto">
              <button className="px-3 py-1.5 text-sm font-bold bg-[var(--color-papel)] rounded-md shadow-sm border border-[var(--color-zinco-200)]">Relevantes</button>
              <button className="px-3 py-1.5 text-sm font-medium text-[var(--color-zinco)] hover:text-[var(--color-tinta)]">Avaliados</button>
              <button className="px-3 py-1.5 text-sm font-medium text-[var(--color-zinco)] hover:text-[var(--color-tinta)]">Perto</button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.map(provider => (
              <ProviderCard key={provider.slug} {...provider} />
            ))}
          </div>
          
          {results.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary">Carregar mais resultados</Button>
            </div>
          )}
        </main>

      </div>
    </PageShell>
  )
}
