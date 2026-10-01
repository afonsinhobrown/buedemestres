export type TradeColor = 'cobalto' | 'amarelo' | 'oxido' | 'papel'

const tradeColors: Record<string, TradeColor> = {
  // Automóvel (Cobalto)
  'mecânico': 'cobalto',
  'bate-chapa': 'cobalto',
  'electricista auto': 'cobalto',

  // Construção e Manutenção (Óxido)
  'pedreiro': 'oxido',
  'carpinteiro': 'oxido',
  'canalizador': 'oxido',
  'pintor': 'oxido',
  'electricista': 'oxido',

  // Educação e Ensino (Amarelo)
  'explicador': 'amarelo',
  'professor': 'amarelo',

  // Serviços Pessoais e Beleza (Papel)
  'cabeleireiro': 'papel',
  'barbeiro': 'papel',
  'manicure': 'papel',
  
  // Limpeza e Casa (Cobalto)
  'empregada doméstica': 'cobalto',
  'jardineiro': 'cobalto',

  // Tecnologia (Amarelo)
  'técnico de informática': 'amarelo',
  'reparação de telemóveis': 'amarelo',
}

/**
 * Devolve a cor da placa para um determinado ofício.
 * O ofício deve ser em minúsculas. Devolve 'cobalto' por defeito.
 */
export function getTradeColor(tradeName: string): TradeColor {
  const normalized = tradeName.toLowerCase().trim()
  return tradeColors[normalized] || 'cobalto'
}
