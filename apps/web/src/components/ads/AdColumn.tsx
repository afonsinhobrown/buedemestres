import Image from 'next/image';
import Link from 'next/link';
import type { Ad } from '@/lib/ads';

function AdCard({ ad }: { ad: Ad }) {
  const media = (
    <span className="ad-media">
      <Image
        src={ad.src}
        alt={ad.alt}
        fill
        sizes="232px"
        className="ad-img"
      />
    </span>
  );

  const body = (
    <>
      <span className="ad-tag">{ad.label}</span>
      {media}
    </>
  );

  if (!ad.href) {
    return <div className="ad">{body}</div>;
  }

  return (
    <Link href={ad.href} className="ad" aria-label={`${ad.label}: ${ad.alt}`}>
      {body}
    </Link>
  );
}

interface AdColumnProps {
  items: Ad[]
  side: 'left' | 'right'
}

/**
 * Coluna vertical de publicidade fixa num dos lados do ecrã.
 * Só aparece a partir de 1780px de largura, altura em que o conteúdo
 * (1240px centrados) deixa margem lateral suficiente.
 */
export function AdColumn({ items, side }: AdColumnProps) {
  if (items.length === 0) return null;

  return (
    <aside
      className="ads-side"
      data-side={side}
      aria-label={side === 'left' ? 'Publicidade à esquerda' : 'Publicidade à direita'}
    >
      {items.map((ad) => (
        <AdCard key={ad.id} ad={ad} />
      ))}
    </aside>
  );
}