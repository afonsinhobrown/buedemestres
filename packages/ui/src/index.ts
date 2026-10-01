/**
 * Tokens de design do Bué de Mestres.
 * Fonte de verdade: BUEDEMESTRES_FRONTEND_DESIGN.md secção 3.
 *
 * Regra do projecto: nenhuma cor, raio ou tamanho é escrito "à mão".
 * Tudo vem daqui. A versão web consome estes tokens via `@theme` (Tailwind v4);
 * as apps React Native consomem este módulo directamente.
 */

// ─── Cor (secção 3.1) ──────────────────────────────────────────────────────────

export const colors = {
  /** Cobalto de esmalte — cor de marca, botões primários, ligações */
  cobalto: '#2444C8',
  /** Amarelo de placa — SÓ para selo Verificado, "Em destaque" e anel de foco */
  amarelo: '#FFC61A',
  /** Vermelho óxido — erros, acções destrutivas, placas vermelhas */
  oxido: '#BF3A21',
  /** Tinta — texto principal e bordas de placas */
  tinta: '#12163A',
  /** Cal — fundo da aplicação */
  cal: '#EDF0F2',
  /** Zinco — texto secundário, ícones inactivos */
  zinco: '#5B6472',

  // Auxiliares
  papel: '#FFFFFF',
  cobalto100: '#DCE3FA',
  cobalto700: '#1A329A',
  zinco200: '#D5DAE0',
  verde: '#1E7F4F',
  oxido100: '#F7DDD7',
} as const

export type ColorToken = keyof typeof colors

/** As 6 cores nomeadas da paleta-base, por ordem de uso na marca */
export const PALETTE = [
  colors.cobalto,
  colors.amarelo,
  colors.oxido,
  colors.tinta,
  colors.cal,
  colors.zinco,
] as const

// ─── Tipografia (secção 3.2) ───────────────────────────────────────────────────

export const fonts = {
  /** Títulos e placas — estreita e pesada na placa, larga nos títulos de página */
  display: 'Archivo',
  /** Texto e interface — legibilidade máxima em ecrãs pequenos */
  sans: 'Atkinson Hyperlegible',
} as const

/**
 * Escala mobile-first, razão ≈ 1,25.
 * `clamp` onde o doc indica (text-3xl).
 */
export const typeScale = {
  xs: { fontSize: 13, lineHeight: 13 * 1.4 },
  sm: { fontSize: 15, lineHeight: 15 * 1.5 },
  base: { fontSize: 17, lineHeight: 17 * 1.55 },
  lg: { fontSize: 21, lineHeight: 21 * 1.4 },
  xl: { fontSize: 26, lineHeight: 26 * 1.2 },
  '2xl': { fontSize: 33, lineHeight: 33 * 1.1 },
  '3xl': { fontSize: 48, lineHeight: 48 * 1.02 },
} as const

export type TypeToken = keyof typeof typeScale

/** Alvos de toque: mínimo 48 px (doc §7 e §10). */
export const tapTarget = {
  min: 48,
  control: 52,
} as const

// ─── Espaçamento (secção 3.3) — base de 4 px ──────────────────────────────────

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  18: 72,
} as const

export type SpaceToken = keyof typeof space

/** Raios diferentes por hierarquia — nunca um raio único. */
export const radius = {
  /** Placas, tabela de preços, selos */
  placa: 4,
  /** Fotografias */
  foto: 8,
  /** Botões, inputs, chips de filtro */
  controlo: 10,
  /** Bottom sheets (só cantos superiores) */
  folha: 20,
  /** Etiquetas de estado, contadores */
  pilula: 999,
} as const

export type RadiusToken = keyof typeof radius

/** Bordas: 2 px tinta em placas e input em foco; 1 px zinco-200 em divisórias. */
export const border = {
  /** Elemento-placa */
  placa: 2,
  /** Divisória fina */
  divisa: 1,
  /** Input em foco */
  foco: 2,
} as const

// ─── Cores de placa por ofício (secção 11) ─────────────────────────────────────

export type PlacaColor = 'cobalto' | 'amarelo' | 'oxido' | 'papel'

/**
 * Mapa de ofício → cor de placa. Consistente e determinístico (não escolhido
 * pelo utilizador) para manter a coerência visual da "rua de oficinas".
 */
const PLACA_POR_OFICIO: Record<string, PlacaColor> = {
  // Automóvel
  'mecânico': 'cobalto',
  'electricista auto': 'cobalto',
  'chapeiro': 'cobalto',
  'pintor auto': 'cobalto',
  'pneus e balanceamento': 'cobalto',
  'lavagem': 'cobalto',

  // Construção e repações
  pedreiro: 'oxido',
  carpinteiro: 'oxido',
  canalizador: 'oxido',
  electricista: 'oxido',
  pintor: 'oxido',
  serralheiro: 'oxido',
  ladrilhador: 'oxido',
  soldador: 'oxido',
  vidraceiro: 'oxido',

  // Educação
  explicador: 'amarelo',
  'aulas de música': 'amarelo',
  'preparação de exames': 'amarelo',

  // Tecnologia
  'técnico de computadores': 'amarelo',
  'técnico de telemóveis': 'amarelo',
  'redes e cctv': 'amarelo',
  'design e web': 'amarelo',

  // Casa e limpeza
  limpezas: 'cobalto',
  jardinagem: 'cobalto',
  mudanças: 'cobalto',
  dedetização: 'cobalto',

  // Beleza e bem-estar
  cabeleireiro: 'papel',
  barbeiro: 'papel',
  manicure: 'papel',
  maquilhagem: 'papel',
  massagens: 'papel',

  // Eventos
  'fotografia e vídeo': 'oxido',
  'dj e som': 'oxido',
  decoração: 'oxido',
  catering: 'oxido',
  bolos: 'oxido',

  // Frio e electrodomésticos
  refrigeração: 'cobalto',
  'reparação de electrodomésticos': 'cobalto',
  'painéis solares': 'cobalto',

  // Moda
  alfaiate: 'papel',
  costureira: 'papel',
  sapateiro: 'papel',
}

/** Cor de fundo e cor de texto de cada variante de placa. */
export const placaVariants: Record<
  PlacaColor,
  { background: string; color: string; moldura: string }
> = {
  cobalto: { background: colors.cobalto, color: colors.papel, moldura: colors.tinta },
  amarelo: { background: colors.amarelo, color: colors.tinta, moldura: colors.tinta },
  oxido: { background: colors.oxido, color: colors.papel, moldura: colors.tinta },
  papel: { background: colors.papel, color: colors.tinta, moldura: colors.cobalto },
}

/** Devolve a cor da placa para um ofício. 'cobalto' por defeito. */
export function getPlacaColor(oficio: string): PlacaColor {
  return PLACA_POR_OFICIO[oficio.toLowerCase().trim()] ?? 'cobalto'
}

// ─── Inclinação da placa (secção 4.1 e §11) ────────────────────────────────────

/**
 * Rotação estável por `hash(slug)` entre −1° e +1°.
 * NUNCA aleatória a cada carregamento (senão as placas "tremem").
 * Desligada em listas de resultados, para legibilidade.
 */
export function placaTilt(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0
  }
  // h em [0,1)
  const unit = h / 0xffffffff
  return Math.round((unit * 2 - 1) * 10) / 10 // -1.0 … +1.0, uma casa decimal
}

// ─── Etiquetas de estado de trabalho (secção 8, JOB_STATUS_LABELS) ─────────────

export type EstadoVisual = 'cobalto' | 'tinta' | 'verde' | 'zinco' | 'oxido'

export const estadoColors: Record<EstadoVisual, string> = {
  cobalto: colors.cobalto,
  tinta: colors.tinta,
  verde: colors.verde,
  zinco: colors.zinco,
  oxido: colors.oxido,
}

// ─── Formatação (secção 3.2) ──────────────────────────────────────────────────

/**
 * Preço: `1 500 MT` — espaço como separador de milhares, sem casas decimais
 * quando são zero. `tabular-nums` é aplicado pelo componente, não aqui.
 */
export function formatMT(amount: number): string {
  const arredondado = Math.round(amount * 100) / 100
  const inteiro = Number.isInteger(arredondado)
  return arredondado.toLocaleString('pt-MZ', {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** Distância em metros → "850 m" ou "3,4 km" */
export function formatDistance(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`
  return `${(metros / 1000).toLocaleString('pt-MZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`
}

/** Segundos → "8 min" (arredondado, mínimo 1) */
export function formatDuration(segundos: number): string {
  if (segundos < 60) return `${Math.max(1, Math.round(segundos))} seg`
  const minutos = Math.round(segundos / 60)
  return `${minutos} min`
}

/** Data → `dd/MM/yyyy`; hora em 24 h. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-MZ')
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
}