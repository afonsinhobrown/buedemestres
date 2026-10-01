/**
 * KYC Stub — implementação de reserva para desenvolvimento.
 * Em produção, substituir pela API comercial (ou stack própria) fornecida pela RFL.
 * 
 * NUNCA USAR EM PRODUÇÃO — não faz verificação real.
 */
import type { KycProvider, KycSubmitInput, KycResult } from './index'

export const kycStubProvider: KycProvider = {
  name: 'stub',

  isAvailable() {
    return process.env.NODE_ENV !== 'production'
  },

  async submit({ verificationId }: KycSubmitInput) {
    console.warn('[KYC STUB] submit() chamado. Não é verificação real.')
    return { providerRef: `stub-${verificationId}` }
  },

  async handleCallback(_req: Request): Promise<KycResult> {
    console.warn('[KYC STUB] handleCallback() chamado.')
    return {
      providerRef: 'stub-callback',
      decision: 'auto_review',
      ocr: {
        confidence: 0.5,
      },
      faceMatchScore: 0.5,
      livenessScore: 0.5,
    }
  },
}
