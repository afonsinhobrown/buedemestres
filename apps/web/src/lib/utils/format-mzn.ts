/**
 * Formata um valor numérico para a moeda Metical (MT) com as regras de Moçambique.
 * - Espaço como separador de milhares (ex: 1 500)
 * - Sem casas decimais quando são zero (ex: 1 500 MT)
 */
export function formatMT(value: number | null | undefined): string {
  if (value == null) return '0 MT'
  
  const formatter = new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  
  // O Intl do JS por vezes usa NBSP (non-breaking space) ou formata ligeiramente diferente
  // Vamos garantir que o formato bate certo com '1 500 MT'
  
  // Uma alternativa mais simples e robusta se o Intl.NumberFormat falhar
  // no formato exacto desejado:
  const isInteger = Number.isInteger(value)
  const parts = value.toFixed(isInteger ? 0 : 2).split('.')
  
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  
  if (parts.length > 1 && parseInt(parts[1]) !== 0) {
    return `${intPart},${parts[1]} MT`
  }
  
  return `${intPart} MT`
}
