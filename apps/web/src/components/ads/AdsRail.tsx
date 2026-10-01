import Image from 'next/image';
import Link from 'next/link';
import { ads, type Ad } from '@/lib/ads';

function AdCard({ ad }: { ad: Ad }) {
  const media = (
    <span className="ad-media">
      <Image
        src={ad.src}
        alt={ad.alt}
        fill
        sizes="(max-width: 900px) 200px, 236px"
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

interface AdsRailProps {
  /** Anúncios a mostrar. Por omissão usa o manifest completo. */
  items?: Ad[];
  title?: string;
  note?: string;
}

export function AdsRail({
  items = ads,
  title = 'Publicidade',
  note = 'Espaço reservado aos nossos parceiros',
}: AdsRailProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label={title} className="shell" style={{ paddingTop: 34, paddingBottom: 10 }}>
      <div className="ads-head">
        <h2 className="h2">{title}</h2>
        <p className="ads-note">{note}</p>
      </div>
      <ul className="ads-rail" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((ad) => (
          <li key={ad.id} style={{ flex: '0 0 auto' }}>
            <AdCard ad={ad} />
          </li>
        ))}
      </ul>
    </section>
  );
}