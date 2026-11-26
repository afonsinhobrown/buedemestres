export function formatMT(value: number | string | null | undefined): string {
  if (value == null || value === '') return '0 MT'

  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '0 MT'

  const isInteger = Number.isInteger(amount)
  const parts = amount.toFixed(isInteger ? 0 : 2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  if (parts.length > 1 && parseInt(parts[1]) !== 0) {
    return `${intPart},${parts[1]} MT`
  }

  return `${intPart} MT`
}
