// Regra de segurança anti-bypass: Bloqueia dígitos e palavras que representem números por extenso
export const NUMBER_WORDS = [
  'zero', 'um', 'uma', 'dois', 'duas', 'tres', 'três', 'quatro', 'cinco',
  'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze',
  'quatorze', 'quinze', 'dezasseis', 'dezesseis', 'dezassete', 'dezessete',
  'dezoito', 'dezanove', 'dezenove', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento', 'mil'
]

export const FORBIDDEN_CONTACT_KEYWORDS = [
  'whatsapp', 'zap', 'telefone', 'telemovel', 'telemóvel', 'contacto', 'contato', 'tlf', 'chamada'
]

export interface AntiBypassResult {
  isValid: boolean
  errorMessage?: string
  detectedTerm?: string
}

export function validateAntiPhoneBypass(text: string): AntiBypassResult {
  if (!text || !text.trim()) return { isValid: true }

  // 1. Bloquear qualquer dígito numérico (0 a 9)
  if (/[0-9]/.test(text)) {
    return {
      isValid: false,
      errorMessage: 'Por segurança da plataforma, não é permitido digitar algarismos ou números de telefone.'
    }
  }

  // 2. Normalizar texto sem acentos e separar palavras
  const cleanText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const words = cleanText.split(/[^a-z]+/).filter(Boolean)

  const normalizedNumberWords = NUMBER_WORDS.map(w =>
    w.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  )

  for (const w of words) {
    if (normalizedNumberWords.includes(w)) {
      return {
        isValid: false,
        detectedTerm: w,
        errorMessage: `Não é permitido escrever números por extenso ("${w}") para evitar o envio de contactos.`
      }
    }
  }

  // 3. Bloquear termos proibidos de contacto externo
  const normalizedKeywords = FORBIDDEN_CONTACT_KEYWORDS.map(k =>
    k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  )

  for (const w of words) {
    if (normalizedKeywords.includes(w)) {
      return {
        isValid: false,
        detectedTerm: w,
        errorMessage: `Todo o contacto é feito no sistema. Não é permitido referir "${w}".`
      }
    }
  }

  return { isValid: true }
}
