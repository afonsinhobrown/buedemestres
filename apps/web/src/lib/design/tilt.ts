/**
 * Gera um número "aleatório" mas estável para uma dada string.
 * Retorna um valor entre -1 e 1 (graus).
 */
export function getStableTilt(slug: string): number {
  if (!slug) return 0
  
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    const char = slug.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // Normalizar para um número entre 0 e 1
  const normalized = Math.abs(hash) / 2147483647 
  
  // Mapear para intervalo -1 a 1
  return (normalized * 2) - 1
}
