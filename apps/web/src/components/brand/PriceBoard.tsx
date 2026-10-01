import { formatMT } from '@/lib/utils/format-mzn'
import { cn } from '@/lib/utils'

export interface PriceItem {
  id: string
  name: string
  price?: number
  isEstimate?: boolean
}

export interface PriceBoardProps {
  items: PriceItem[]
  className?: string
}

export function PriceBoard({ items, className }: PriceBoardProps) {
  if (!items || items.length === 0) return null

  return (
    <div className={cn(
      "bg-[var(--color-papel)] border-2 border-[var(--color-tinta)] rounded-[var(--radius-placa)] p-4 md:p-6",
      className
    )}>
      <h3 className="font-bold text-lg mb-4 text-[var(--color-tinta)]">Tabela de Preços</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-end w-full group">
            <span className="text-[var(--color-tinta)] font-medium bg-[var(--color-papel)] pr-2 shrink-0">
              {item.name}
            </span>
            
            {/* Pontos condutores (dotted leader) */}
            <span className="flex-1 border-b-2 border-dotted border-[var(--color-zinco-200)] mb-1.5 mx-1" />
            
            <span className={cn(
              "bg-[var(--color-papel)] pl-2 shrink-0 text-right",
              item.price ? "font-bold text-[var(--color-tinta)] tabular-nums" : "text-sm text-[var(--color-zinco)] italic"
            )}>
              {item.price 
                ? <>{item.isEstimate && <span className="text-sm font-normal mr-1">desde</span>}{formatMT(item.price)}</>
                : "sob orçamento"
              }
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
