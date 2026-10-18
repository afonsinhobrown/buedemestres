/** Estados terminais do ciclo de vida de um trabalho. */
export const TERMINAL_JOB_STATUSES = ['completed', 'cancelled', 'expired'] as const

/** Transições permitidas entre estados de um trabalho. */
export const JOB_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ['accepted', 'cancelled', 'expired'],
  scheduled: ['accepted', 'in_progress', 'awaiting_confirmation', 'cancelled', 'expired'],
  accepted: ['price_proposed', 'puxado', 'price_agreed', 'en_route', 'cancelled', 'expired'],
  price_proposed: ['puxado', 'price_agreed', 'cancelled', 'expired'],
  puxado: ['price_proposed', 'price_agreed', 'cancelled', 'expired'],
  price_agreed: ['en_route', 'cancelled', 'expired'],
  en_route: ['arrived', 'in_service', 'cancelled', 'expired'],
  arrived: ['in_service', 'cancelled', 'expired'],
  in_service: ['awaiting_confirmation', 'cancelled', 'disputed'],
  in_progress: ['awaiting_confirmation', 'completed', 'cancelled', 'disputed'],
  awaiting_confirmation: ['completed', 'disputed', 'in_service'],
  completed: [],
  cancelled: [],
  expired: [],
  disputed: ['completed', 'cancelled', 'in_service'],
}

export function canTransitionJob(from: string, to: string): boolean {
  return (JOB_TRANSITIONS[from] ?? []).includes(to)
}

/**
 * Normaliza o estado de um `service_request` para o vocabulário mais simples
 * usado pelo tracker do cliente.
 */
export function normalizeRequestStatus(status: string | undefined | null): string | undefined {
  switch (status) {
    case 'open':
    case 'in_negotiation':
      return 'pending'
    case 'price_proposed':
    case 'puxado':
      return 'price_proposed'
    case 'accepted':
      return 'accepted'
    case 'in_progress':
      return 'in_progress'
    case 'completed':
      return 'completed'
    case 'cancelled':
    case 'expired':
      return 'cancelled'
    default:
      return status ?? undefined
  }
}
