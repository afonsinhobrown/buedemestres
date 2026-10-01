/**
 * Converte um texto em slug URL-safe.
 * Ex: "José & Maria's" → "jose-marias"
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remover diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remover chars especiais
    .trim()
    .replace(/[\s_-]+/g, '-') // espaços → hífen
    .replace(/^-+|-+$/g, '') // remover hifens no início/fim
}
