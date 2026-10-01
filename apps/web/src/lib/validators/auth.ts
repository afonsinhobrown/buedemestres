import { z } from 'zod'

// Telefone moçambicano: +258 8X XXX XXXX
const phoneRegex = /^\+258 8[2-7] \d{3} \d{4}$/

export const RegisterSchema = z.object({
  full_name: z
    .string({ required_error: 'Nome obrigatório.' })
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' })
    .max(120, { message: 'Nome muito longo.' })
    .trim(),

  email: z
    .string({ required_error: 'E-mail obrigatório.' })
    .email({ message: 'E-mail inválido.' })
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: 'Palavra-passe obrigatória.' })
    .min(8, { message: 'Mínimo de 8 caracteres.' })
    .max(72, { message: 'Máximo de 72 caracteres.' }),

  referral_code: z
    .string()
    .toUpperCase()
    .trim()
    .optional()
    .or(z.literal('')),
})

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'E-mail obrigatório.' })
    .email({ message: 'E-mail inválido.' })
    .toLowerCase()
    .trim(),

  password: z.string({ required_error: 'Palavra-passe obrigatória.' }).min(1),
})

export const UpdateProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' })
    .max(120)
    .trim()
    .optional(),

  phone: z
    .string()
    .regex(phoneRegex, {
      message: 'Telemóvel inválido. Use o formato +258 8X XXX XXXX',
    })
    .optional()
    .or(z.literal('')),

  district_id: z.number().int().positive().optional().nullable(),
})

export const ActivateProviderSchema = z.object({
  business_name: z
    .string({ required_error: 'Nome do negócio obrigatório.' })
    .min(2)
    .max(120)
    .trim(),

  primary_category_id: z
    .number({ required_error: 'Categoria obrigatória.' })
    .int()
    .positive(),

  district_id: z
    .number({ required_error: 'Distrito obrigatório.' })
    .int()
    .positive(),

  phone: z
    .string({ required_error: 'Telemóvel obrigatório para profissionais.' })
    .regex(phoneRegex, {
      message: 'Telemóvel inválido. Use o formato +258 8X XXX XXXX',
    }),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type ActivateProviderInput = z.infer<typeof ActivateProviderSchema>

// Estado de action genérico
export interface ActionSuccess {
  success: true
  message?: string
}

export interface ActionFailure {
  success: false
  message: string
  errors?: Record<string, string[]>
}

export type ActionState = ActionSuccess | ActionFailure

/** Extrai os erros de campo de um ActionState (retorna undefined se success=true) */
export function fieldErrors(state: ActionState | undefined): Record<string, string[]> | undefined {
  if (!state || state.success) return undefined
  return state.errors
}

