import { TradeSign } from '@/components/brand/TradeSign'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageShell } from '@/components/layout/PageShell'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Design System',
}

export default function DesignSystemPage() {
  return (
    <PageShell noNav>
      <div className="p-4 md:p-8 space-y-16">
        <header>
          <h1 className="text-3xl display-wide">Design System</h1>
          <p className="text-sm text-[var(--color-zinco)] mt-2">
            Referência visual e tokens do Bué de Mestres.
          </p>
        </header>

        {/* Cores */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Cores</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ColorSwatch bg="bg-[var(--color-cobalto)]" name="Cobalto" />
            <ColorSwatch bg="bg-[var(--color-amarelo)]" name="Amarelo" />
            <ColorSwatch bg="bg-[var(--color-oxido)]" name="Óxido" />
            <ColorSwatch bg="bg-[var(--color-tinta)]" name="Tinta" />
            <ColorSwatch bg="bg-[var(--color-cal)]" name="Cal" hasBorder />
            <ColorSwatch bg="bg-[var(--color-papel)]" name="Papel" hasBorder />
            <ColorSwatch bg="bg-[var(--color-zinco)]" name="Zinco" />
            <ColorSwatch bg="bg-[var(--color-verde)]" name="Verde" />
          </div>
        </section>

        {/* Tipografia */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Tipografia</h2>
          <div className="space-y-4 bg-white p-6 rounded-[var(--radius-foto)] border border-gray-100">
            <div>
              <div className="text-xs text-[var(--color-zinco)] mb-1">display-wide . text-3xl</div>
              <h1 className="text-3xl display-wide">Bué deles, no teu bairro.</h1>
            </div>
            <div>
              <div className="text-xs text-[var(--color-zinco)] mb-1">display-wide . text-2xl</div>
              <h2 className="text-2xl display-wide">Tornar-me Profissional</h2>
            </div>
            <div>
              <div className="text-xs text-[var(--color-zinco)] mb-1">font-bold . text-xl</div>
              <h3 className="text-xl font-bold">Avaliações</h3>
            </div>
            <div>
              <div className="text-xs text-[var(--color-zinco)] mb-1">text-base (Texto corrente)</div>
              <p className="text-base prose-mz">
                O Bué de Mestres transporta a placa da oficina para o digital. 
                Cada profissional passa a ter a sua placa. O produto é uma rua de oficinas organizada e verificada.
              </p>
            </div>
            <div>
              <div className="text-xs text-[var(--color-zinco)] mb-1">text-sm</div>
              <p className="text-sm">Texto secundário, rótulos de campo.</p>
            </div>
            <div>
              <div className="text-xs text-[var(--color-zinco)] mb-1">tabular-nums</div>
              <p className="text-lg tabular-nums">Desde 1 500 MT</p>
            </div>
          </div>
        </section>

        {/* Placas (TradeSign) */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Placas (TradeSign)</h2>
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--color-zinco)]">Tamanhos (lg, md, sm)</h3>
            <div className="flex flex-wrap items-end gap-6">
              <TradeSign title="MECÂNICO" subtitle="OFICINA MABUNDA" size="lg" />
              <TradeSign title="MECÂNICO" size="md" />
              <TradeSign title="MECÂNICO" size="sm" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--color-zinco)]">Cores base (determinísticas)</h3>
            <div className="flex flex-wrap items-center gap-6">
              <TradeSign title="CARPINTEIRO" />
              <TradeSign title="EXPLICADOR" />
              <TradeSign title="CABELEIREIRO" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--color-zinco)]">Forçar Cor (Amarelo reservado para foco/destaque)</h3>
            <div className="flex flex-wrap items-center gap-6">
              <TradeSign title="EM DESTAQUE" color="amarelo" size="sm" noTilt />
            </div>
          </div>
        </section>

        {/* Controlos (Botões & Inputs) */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Controlos</h2>
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--color-zinco)]">Botões</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Button>Primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="destructive">Destrutivo</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button disabled>Desactivado</Button>
            </div>
          </div>

          <div className="space-y-4 max-w-sm">
            <h3 className="text-sm font-medium text-[var(--color-zinco)]">Inputs</h3>
            <Input label="Normal" placeholder="Placeholder..." />
            <Input label="Com erro" placeholder="Placeholder..." error="Este campo é obrigatório" />
            <Input label="Desactivado" placeholder="Não editável" disabled />
          </div>
        </section>
      </div>
    </PageShell>
  )
}

function ColorSwatch({ bg, name, hasBorder = false }: { bg: string, name: string, hasBorder?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("h-16 w-full rounded-[var(--radius-foto)]", bg, hasBorder && "border border-[var(--color-zinco-200)]")} />
      <span className="text-xs font-medium">{name}</span>
    </div>
  )
}
