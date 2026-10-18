export type JobPaymentStatus =
  | 'pending_payment'
  | 'held'
  | 'released'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'failed'

/**
 * Uma falha só pode ser registada enquanto o pagamento ainda não foi retido.
 * Assim, uma resposta tardia de "failed" nunca desfaz um "held" já confirmado.
 */
export function canFailPayment(status: string): boolean {
  return status === 'pending_payment'
}

/**
 * A confirmação pode chegar depois de uma falha (corrida webhook/polling):
 * nesse caso o pagamento é promovido de `failed` para `held`.
 */
export function canConfirmPayment(status: string): boolean {
  return status === 'pending_payment' || status === 'failed'
}
