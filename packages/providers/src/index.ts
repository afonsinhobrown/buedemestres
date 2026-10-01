// ─── Payment Provider Interface ───────────────────────────────────────────────

export interface PaymentInitInput {
  paymentId: string
  amount: number
  msisdn?: string
}

export interface PaymentInitResult {
  providerRef?: string
  instructions?: string
}

export interface PaymentWebhookResult {
  providerRef: string
  paymentId: string
  status: 'completed' | 'failed'
}

export interface PaymentProvider {
  name: 'manual' | 'mpesa' | 'emola'
  initiate(input: PaymentInitInput): Promise<PaymentInitResult>
  verifyWebhook(req: Request): Promise<PaymentWebhookResult | null>
}

// ─── KYC Provider Interface ────────────────────────────────────────────────────

export interface KycSubmitInput {
  verificationId: string
  docFront: Blob
  docBack?: Blob
  selfie: Blob
  liveness: Blob[]
  country: 'MZ'
}

export interface KycCheckResult {
  ocr?: {
    name?: string
    docNumber?: string
    dateOfBirth?: string
    expiryDate?: string
    confidence: number
  }
  faceMatchScore?: number
  livenessScore?: number
  livenessFlags?: string[]
  tamperFlags?: string[]
  duplicateDetected?: boolean
}

export interface KycResult extends KycCheckResult {
  providerRef: string
  decision: 'auto_pass' | 'auto_review' | 'auto_fail'
}

export interface KycProvider {
  name: string
  submit(input: KycSubmitInput): Promise<{ providerRef: string }>
  handleCallback(req: Request): Promise<KycResult>
  isAvailable(): boolean
}

// ─── Map Provider Interface ────────────────────────────────────────────────────

export interface LatLng {
  lat: number
  lng: number
}

export interface RouteResult {
  durationSeconds: number
  distanceMeters: number
  polyline?: string
}

export interface MapProvider {
  name: 'osm' | 'google' | 'mapbox'
  getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult>
  getETA(origin: LatLng, destination: LatLng): Promise<number> // seconds
}

// ─── Manual Payment (default, always available) ───────────────────────────────

export const manualPaymentProvider: PaymentProvider = {
  name: 'manual',
  async initiate({ paymentId, amount }) {
    // Instrução para o utilizador fazer transferência manual
    return {
      instructions: `Transfira MT ${amount.toFixed(2)} para o número da RFL via M-Pesa/e-Mola e envie o comprovativo. Referência: ${paymentId.slice(0, 8).toUpperCase()}`,
    }
  },
  async verifyWebhook() {
    // Pagamentos manuais são aprovados pelo admin via painel, não por webhook
    return null
  },
}

// ─── Straight-line ETA fallback ───────────────────────────────────────────────

export function estimateETASeconds(
  origin: LatLng,
  destination: LatLng,
  avgSpeedKmh = 30
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  const distanceM = 2 * R * Math.asin(Math.sqrt(a))
  const roadFactor = 1.4 // Fator de estrada (distância real ≈ 1.4x linha recta)
  const speedMs = (avgSpeedKmh * 1000) / 3600
  return Math.round((distanceM * roadFactor) / speedMs)
}

export * from './kyc-stub'
