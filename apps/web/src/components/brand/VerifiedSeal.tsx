import { Check } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

export interface VerifiedSealProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const sizeConfig = {
  sm: { seal: 'w-5 h-5', icon: 12, text: 'text-[10px]' },
  md: { seal: 'w-7 h-7', icon: 16, text: 'text-xs' },
  lg: { seal: 'w-11 h-11', icon: 24, text: 'text-sm' },
}

export function VerifiedSeal({ size = 'md', showText = true, className }: VerifiedSealProps) {
  const config = sizeConfig[size]

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <div 
        className={cn(
          "relative flex items-center justify-center rounded-full bg-[var(--color-amarelo)] border-2 border-[var(--color-tinta)] shrink-0",
          config.seal
        )}
      >
        <Check size={config.icon} weight="bold" className="text-[var(--color-tinta)] z-10" />
        
        {/* Fio de padrão geométrico em redor (simplificado com um anel tracejado interno) */}
        <div className="absolute inset-[2px] rounded-full border border-dashed border-[var(--color-tinta)] opacity-40 pointer-events-none" />
      </div>
      
      {showText && (
        <span className={cn("font-bold text-[var(--color-tinta)]", config.text)}>
          Verificado
        </span>
      )}
    </div>
  )
}
