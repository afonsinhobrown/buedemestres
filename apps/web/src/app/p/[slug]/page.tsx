import { PageShell } from '@/components/layout/PageShell'
import { TradeSign } from '@/components/brand/TradeSign'
import { VerifiedSeal } from '@/components/brand/VerifiedSeal'
import { PriceBoard } from '@/components/brand/PriceBoard'
import { Button } from '@/components/ui/button'
import { WhatsappLogo, Star, MapPin } from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'Perfil do Mestre',
}

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Dados simulados
  const provider = {
    name: 'Oficina Mabunda',
    tradeName: 'mecânico',
    isVerified: true,
    rating: 4.8,
    reviewCount: 31,
    completedJobs: 126,
    neighborhood: 'Polana, Maputo',
    about: 'Especialista em motores a diesel e gasolina. Mais de 10 anos de experiência na praça. Revisões completas e serviço eléctrico ao domicílio.',
    prices: [
      { id: '1', name: 'Mudança de óleo e filtro', price: 1500, isEstimate: true },
      { id: '2', name: 'Diagnóstico electrónico', price: 800 },
      { id: '3', name: 'Substituição de pastilhas (par)', price: 1200 },
      { id: '4', name: 'Reparação de motor', price: undefined },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=600&q=80',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80'
    ]
  }

  return (
    <PageShell>
      {/* Galeria de topo */}
      <div className="w-full h-[250px] md:h-[400px] flex overflow-x-auto snap-x snap-mandatory hide-scrollbar bg-[var(--color-tinta)]">
        {provider.gallery.map((img, i) => (
          <img key={i} src={img} alt={`Trabalho ${i+1}`} className="w-full md:w-[600px] h-full object-cover shrink-0 snap-center" />
        ))}
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 md:px-0 -mt-12 relative z-10 pb-32">
        {/* A Placa do Mestre */}
        <div className="flex justify-center mb-6 drop-shadow-md">
          <TradeSign title={provider.tradeName.toUpperCase()} subtitle={provider.name} size="lg" />
        </div>

        {/* Info Básica */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex justify-center items-center gap-3">
            {provider.isVerified && <VerifiedSeal size="md" />}
            <div className="flex items-center text-[var(--color-zinco)] text-sm gap-1">
              <MapPin size={16} weight="fill" /> {provider.neighborhood}
            </div>
          </div>
          
          <div className="flex justify-center items-center gap-4 text-sm">
            <div className="flex items-center gap-1 font-bold text-lg tabular-nums">
              <Star size={20} weight="fill" className="text-[var(--color-cobalto)]" />
              {provider.rating?.toFixed(1).replace('.', ',')}
              <span className="text-sm font-normal text-[var(--color-zinco)]">({provider.reviewCount} avaliações)</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-[var(--color-zinco-200)]" />
            <div className="text-[var(--color-tinta)] font-medium">
              {provider.completedJobs} trabalhos concluídos
            </div>
          </div>
        </div>

        {/* Sobre o mestre */}
        <section className="mb-8 bg-[var(--color-papel)] p-6 rounded-[var(--radius-foto)] border border-[var(--color-zinco-200)]">
          <h2 className="font-bold mb-2">Sobre o mestre</h2>
          <p className="prose-mz text-[var(--color-tinta)] leading-relaxed">
            {provider.about}
          </p>
        </section>

        {/* Tabela de Preços */}
        <section className="mb-8">
          <PriceBoard items={provider.prices} />
        </section>
      </div>

      {/* Barra de Acção Fixa */}
      <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 bg-[var(--color-papel)] border-t border-[var(--color-zinco-200)] p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Button size="lg" className="flex-1">Pedir orçamento</Button>
          <Button variant="secondary" size="lg" className="shrink-0 text-[#1E7F4F] border-[var(--color-zinco-200)] hover:bg-[#1E7F4F]/10">
            <WhatsappLogo size={24} />
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
