// Máquina de estados dos trabalhos
export type JobStatus =
  | 'requested'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'price_proposed'
  | 'awaiting_confirmation'
  | 'in_service'
  | 'completed'
  | 'cancelled_by_client'
  | 'cancelled_by_provider'
  | 'expired'
  | 'disputed'

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  requested: 'A procurar mestre',
  accepted: 'Mestre a caminho',
  en_route: 'A caminho',
  arrived: 'Chegou',
  price_proposed: 'Proposta de preço',
  awaiting_confirmation: 'A aguardar confirmação',
  in_service: 'Em serviço',
  completed: 'Concluído',
  cancelled_by_client: 'Cancelado pelo cliente',
  cancelled_by_provider: 'Cancelado pelo mestre',
  expired: 'Expirado',
  disputed: 'Em disputa',
}

// Comissões por plano (valores iniciais - ver plans.commission_rate na DB)
export const PLAN_COMMISSION_DEFAULTS = {
  free: 0.12,   // 12%
  pro: 0.08,    // 8%
  premium: 0.05 // 5%
} as const

// Raios de despacho por ronda (metros)
export const DISPATCH_ROUNDS = [
  { round: 1, radiusM: 5000, limit: 5, offerExpirySec: 60 },
  { round: 2, radiusM: 10000, limit: 8, offerExpirySec: 300 },
  { round: 3, radiusM: 20000, limit: 10, offerExpirySec: 300 },
] as const

// Taxa de deslocação (MT) — por categoria, stored em system_settings
// Esta constante é apenas o fallback
export const DEFAULT_CANCELLATION_FEE_MT = 150

// Retenção automática (horas sem disputa → liberta)
export const AUTO_RELEASE_HOURS = 24

// Validade de presença do mestre (segundos)
export const PRESENCE_TTL_SECONDS = 90

// Formatação de dinheiro MZN
export function formatMT(amount: number): string {
  return `MT ${amount.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Calcula comissão e valor líquido
export function calcCommission(amount: number, rate: number) {
  const commission = Math.round(amount * rate * 100) / 100
  const payout = Math.round((amount - commission) * 100) / 100
  return { commission, payout, rate }
}
