export type AdLabel = 'Patrocinado' | 'Publicidade' | 'Anúncio'

export interface Ad {
  /** Identificador estável, usado como chave de React */
  id: string
  /** Ficheiro em public/ads/ */
  src: string
  /** Texto alternativo (obrigatório para acessibilidade) */
  alt: string
  width: number
  height: number
  /** Destino do clique. Ausente = anúncio decorativo, sem link */
  href?: string
  label: AdLabel
}

/**
 * Manifest de publicidade.
 * Para editar um anúncio: muda o `href`, `alt` ou a ordem do array.
 * As imagens vivem em apps/web/public/ads/.
 */
export const ads: Ad[] = [
  {
    id: 'anuncio-1',
    src: '/ads/1.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 608,
    height: 504,
    href: '/publicidade/1',
    label: 'Patrocinado',
  },
  {
    id: 'anuncio-2',
    src: '/ads/2.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 447,
    height: 447,
    href: '/publicidade/2',
    label: 'Patrocinado',
  },
  {
    id: 'anuncio-3',
    src: '/ads/3.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 426,
    height: 599,
    href: '/publicidade/3',
    label: 'Anúncio',
  },
  {
    id: 'anuncio-5',
    src: '/ads/5.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 447,
    height: 447,
    href: '/publicidade/5',
    label: 'Patrocinado',
  },
  {
    id: 'anuncio-6',
    src: '/ads/6.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 447,
    height: 447,
    href: '/publicidade/6',
    label: 'Patrocinado',
  },
  {
    id: 'anuncio-7',
    src: '/ads/7.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 447,
    height: 447,
    href: '/publicidade/7',
    label: 'Publicidade',
  },
  {
    id: 'anuncio-8',
    src: '/ads/8.jpeg',
    alt: 'Publicidade de uma empresa parceira',
    width: 447,
    height: 447,
    href: '/publicidade/8',
    label: 'Patrocinado',
  },
  {
    id: 'bot',
    src: '/ads/bot.webp',
    alt: 'Assistente Bué de Mestres',
    width: 1080,
    height: 720,
    href: '/ajuda',
    label: 'Anúncio',
  },
]