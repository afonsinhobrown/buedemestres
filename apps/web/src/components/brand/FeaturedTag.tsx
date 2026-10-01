import { cn } from '@/lib/utils'
import { Star } from '@phosphor-icons/react/dist/ssr'

export interface FeaturedTagProps {
  className?: string
}

export function FeaturedTag({ className }: FeaturedTagProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 bg-[var(--color-amarelo)] text-[var(--color-tinta)] px-2 py-0.5 rounded-[var(--radius-placa)] border border-[var(--color-tinta)]",
      className
    )}>
      <Star size={12} weight="fill" />
      <span className="text-[10px] font-bold uppercase tracking-wider">Em destaque</span>
    </div>
  )
}
