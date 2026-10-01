'use client'

import Link from 'next/link'
import { WhatsappLogo, MapPin } from '@phosphor-icons/react/dist/ssr'
import { TradeSign } from '@/components/brand/TradeSign'
import { VerifiedSeal } from '@/components/brand/VerifiedSeal'
import { FeaturedTag } from '@/components/brand/FeaturedTag'
import { Button } from '@/components/ui/button'
import { formatMT } from '@/lib/utils/format-mzn'
import { cn } from '@/lib/utils'

export interface ProviderCardProps {
  slug: string
  name: string
  tradeName: string
  tradeCategory: string
  rating: number | null
  reviewCount: number
  neighborhood: string
  distanceKm?: number
  minPrice?: number
  isVerified: boolean
  isFeatured: boolean
  photoUrl?: string
}

export function ProviderCard({
  slug,
  name,
  tradeName,
  tradeCategory,
  rating,
  reviewCount,
  neighborhood,
  distanceKm,
  minPrice,
  isVerified,
  isFeatured,
  photoUrl
}: ProviderCardProps) {
  return (
    <div className={cn(
      "flex flex-col bg-[var(--color-papel)] rounded-[var(--radius-foto)] border border-[var(--color-zinco-200)] overflow-hidden relative",
      isFeatured && "border-[var(--color-amarelo)]"
    )}>
      {isFeatured && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-amarelo)] z-10" />
      )}

      <div className="flex h-[140px] md:h-[180px]">
        {/* Fotografia (4:3) ou Placa grande caso não tenha foto */}
        <div className="w-[40%] bg-[var(--color-cal)] border-r border-[var(--color-zinco-200)] flex items-center justify-center relative overflow-hidden shrink-0">
          {photoUrl ? (
             <img src={photoUrl} alt={`Trabalho de ${name}`} className="w-full h-full object-cover" loading="lazy" />
          ) : (
             <div className="scale-75 md:scale-100 origin-center">
               <TradeSign title={tradeName.toUpperCase()} color="cobalto" size="md" noTilt />
             </div>
          )}
          
          {isFeatured && (
            <div className="absolute top-2 left-2 z-10">
              <FeaturedTag />
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div className="w-[60%] p-3 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1">
              <Link href={`/p/${slug}`} className="hover:underline">
                <h3 className="text-lg md:text-xl display-wide leading-tight text-[var(--color-tinta)] line-clamp-1">{name}</h3>
              </Link>
              <TradeSign title={tradeName} size="sm" noTilt />
            </div>

            <div className="flex items-center gap-1 mb-2">
              <span className="text-base font-bold tabular-nums text-[var(--color-tinta)]">
                {rating ? rating.toFixed(1).replace('.', ',') : 'Novo'}
              </span>
              {rating && (
                <span className="text-xs text-[var(--color-zinco)]">({reviewCount})</span>
              )}
              {isVerified && (
                <div className="ml-1">
                  <VerifiedSeal size="sm" showText={false} />
                </div>
              )}
            </div>

            <div className="flex items-center text-xs text-[var(--color-zinco)] gap-1">
              <MapPin size={14} weight="fill" />
              <span className="line-clamp-1">{neighborhood} {distanceKm && `· ${distanceKm} km`}</span>
            </div>
          </div>

          <div className="mt-2 text-sm font-medium text-[var(--color-tinta)] tabular-nums">
            {minPrice ? `desde ${formatMT(minPrice)}` : 'sob orçamento'}
          </div>
        </div>
      </div>

      {/* Acções (Botões em baixo) */}
      <div className="flex border-t border-[var(--color-zinco-200)] bg-[var(--color-cal)]/30 p-2 gap-2">
        <Button variant="secondary" size="sm" className="w-12 px-0 shrink-0 border-[var(--color-zinco-200)] text-[#1E7F4F] hover:bg-[#1E7F4F]/10">
          <WhatsappLogo size={20} weight="regular" />
          <span className="sr-only">WhatsApp</span>
        </Button>
        <Button size="sm" className="w-full text-[13px] md:text-sm" asChild>
          <Link href={`/pedidos/novo?mestre=${slug}`}>
            Pedir orçamento
          </Link>
        </Button>
      </div>
    </div>
  )
}
