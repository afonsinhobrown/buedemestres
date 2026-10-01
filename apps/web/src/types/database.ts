// Tipos gerados a partir do esquema de base de dados
// Actualizar conforme novas tabelas forem adicionadas

export type UserRole = 'client' | 'provider' | 'admin' | 'superadmin' | 'finance'
export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type SubStatus = 'active' | 'expired' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  district_id: number | null
  referral_code: string
  referred_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // campo virtual: hash da palavra-passe (nunca exposto ao cliente)
  password_hash?: string
}

export interface ProviderProfile {
  profile_id: string
  slug: string
  business_name: string
  headline: string | null
  bio: string | null
  years_experience: number | null
  primary_category_id: number | null
  district_id: number | null
  address: string | null
  lat: number | null
  lng: number | null
  service_radius_km: number | null
  whatsapp: string | null
  working_hours: Record<string, unknown>
  verification: VerificationStatus
  verified_at: string | null
  is_available: boolean
  is_published: boolean
  rating_avg: number
  rating_count: number
  jobs_completed: number
  created_at: string
  updated_at: string
}

export interface District {
  id: number
  province_id: number
  name: string
}

export interface Province {
  id: number
  name: string
}

export interface Category {
  id: number
  parent_id: number | null
  slug: string
  name: string
  icon: string | null
  sort_order: number
  is_active: boolean
}

export interface Wallet {
  profile_id: string
  balance: number
  updated_at: string
}

export interface Plan {
  id: number
  code: string
  name: string
  price: number
  duration_days: number
  max_services: number
  max_photos: number
  max_categories: number
  can_quote_unlimited: boolean
  monthly_quotes: number | null
  featured_days_included: number
  badge: string | null
  is_active: boolean
  sort_order: number
}

// Payload guardado no JWT de sessão
export interface SessionPayload {
  userId: string
  role: UserRole
  expiresAt: Date
  mfaVerified?: boolean
  mustChangePassword?: boolean
}
