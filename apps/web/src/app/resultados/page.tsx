import type { Metadata } from 'next'
import { loadDiscoveryData } from '@/lib/discovery-server'
import { getOptionalSession } from '@/lib/session'
import DiscoveryView from './DiscoveryView'
import './discovery.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Encontrar mestres perto de ti — Bué de Mestres',
  description:
    'Pesquisa mecânicos, electricistas, canalizadores, explicadores e outros mestres verificados perto de ti. Compara avaliações e pede orçamento na Bué de Mestres.',
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function toPositiveInt(value: string): number | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.trunc(number)
}

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const q = firstString(params.q).trim()
  const districtId = toPositiveInt(firstString(params.distrito).trim())
  const verifiedOnly = firstString(params.verificado) === '1'
  const availableOnly = firstString(params.disponivel) === '1'

  const data = await loadDiscoveryData({
    q,
    categoryValue: firstString(params.categoria).trim(),
    districtId,
    verifiedOnly,
    availableOnly,
  })

  const session = await getOptionalSession().catch(() => null)

  return (
    <DiscoveryView
      {...data}
      q={q}
      verifiedOnly={verifiedOnly}
      availableOnly={availableOnly}
      isAuthenticated={Boolean(session?.userId)}
    />
  )
}
