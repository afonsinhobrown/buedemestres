/**
 * Políticas de Retenção e Fidelização - Bué de Mestres
 * 
 * Regra 1 (Mestre):
 * - No 11º serviço concluído pelo mestre, a taxa de comissão da plataforma é 0% (serviço 100% limpo para o mestre sem desconto de comissão).
 * 
 * Regra 2 (Cliente):
 * - A partir do 10º serviço (ou seja, no 11º serviço em diante), o cliente recebe 10% de desconto de fidelidade no valor do serviço.
 */

export interface LoyaltyCalculation {
  originalPrice: number
  clientCompletedJobs: number
  providerCompletedJobs: number
  clientDiscountPercent: number
  clientDiscountAmount: number
  finalClientPrice: number
  commissionRate: number
  commissionAmount: number
  providerPayout: number
  isProviderBonusJob: boolean
  isClientLoyal: boolean
  notes: string[]
}

export function calculateLoyaltyPricing(params: {
  quotedPrice: number
  clientCompletedCount?: number
  providerCompletedCount?: number
  standardCommissionRate?: number
}): LoyaltyCalculation {
  const {
    quotedPrice,
    clientCompletedCount = 0,
    providerCompletedCount = 0,
    standardCommissionRate = 0.10 // 10% padrão
  } = params

  const notes: string[] = []

  // 1. Desconto do Cliente: se já tem >= 10 serviços (este é o 11º ou mais)
  const isClientLoyal = clientCompletedCount >= 10
  const clientDiscountPercent = isClientLoyal ? 0.10 : 0.00
  const clientDiscountAmount = Math.round(quotedPrice * clientDiscountPercent * 100) / 100
  const finalClientPrice = Math.max(0, quotedPrice - clientDiscountAmount)

  if (isClientLoyal) {
    notes.push(`🎉 Cliente VIP (${clientCompletedCount} serviços): 10% de desconto aplicado (-${clientDiscountAmount} MT)!`)
  }

  // 2. Bónus do Mestre: no 11º serviço (ou múltiplo de 11) o serviço é sem desconto da plataforma (comissão 0%)
  // Próximo serviço do mestre é (providerCompletedCount + 1)
  const nextProviderJobNumber = providerCompletedCount + 1
  const isProviderBonusJob = (nextProviderJobNumber % 11 === 0)

  let commissionRate = standardCommissionRate
  if (isProviderBonusJob) {
    commissionRate = 0.00
    notes.push(`🏆 Bónus do Mestre: O seu ${nextProviderJobNumber}º serviço é 100% para si! Comissão da plataforma é 0 MT.`)
  }

  const commissionAmount = Math.round(finalClientPrice * commissionRate * 100) / 100
  const providerPayout = Math.round((finalClientPrice - commissionAmount) * 100) / 100

  return {
    originalPrice: quotedPrice,
    clientCompletedJobs: clientCompletedCount,
    providerCompletedJobs: providerCompletedCount,
    clientDiscountPercent,
    clientDiscountAmount,
    finalClientPrice,
    commissionRate,
    commissionAmount,
    providerPayout,
    isProviderBonusJob,
    isClientLoyal,
    notes
  }
}
