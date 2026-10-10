import React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import MapDynamic from '@/components/MapDynamic';

export const dynamic = 'force-dynamic';
export default async function ResultadosPage({ searchParams }: { searchParams: { q?: string, onde?: string } }) {
  const query = searchParams.q || '';
  const onde = searchParams.onde || '';

  // Use the search_providers function from Postgres
  const res = await db.query(`
    SELECT profile_id, slug, business_name, headline, rating_avg, rating_count, verified, rank,
           (SELECT name FROM districts d JOIN provider_profiles pp2 ON pp2.district_id = d.id WHERE pp2.profile_id = sp.profile_id) as district_name,
           (SELECT lat FROM provider_profiles pp2 WHERE pp2.profile_id = sp.profile_id) as lat,
           (SELECT lng FROM provider_profiles pp2 WHERE pp2.profile_id = sp.profile_id) as lng,
           (SELECT c.name FROM provider_profiles pp2 JOIN categories c ON pp2.primary_category_id = c.id WHERE pp2.profile_id = sp.profile_id) as category_name
    FROM search_providers($1) sp
  `, [query]);
  
  let providers = res.rows;

  // Fallback se a pesquisa de texto não retornar nada
  if (providers.length === 0) {
    const fallback = await db.query(`
      SELECT pp.profile_id, pp.slug, pp.business_name, pp.headline, pp.rating_avg, pp.rating_count, 
             (pp.verification = 'approved') as verified, d.name as district_name,
             pp.lat, pp.lng, c.name as category_name, 0 as rank
      FROM provider_profiles pp
      JOIN districts d ON pp.district_id = d.id
      JOIN categories c ON pp.primary_category_id = c.id
      WHERE pp.is_published = true
      ORDER BY pp.rating_avg DESC
      LIMIT 10
    `);
    providers = fallback.rows;
  }

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="selo" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10.5" fill="#FFC61A" stroke="#12163A" strokeWidth="2" />
          <circle cx="12" cy="12" r="7.6" fill="none" stroke="#12163A" strokeWidth="1" strokeDasharray="2 1.6" />
          <path d="M7.6 12.4l3 3 5.8-6.4" fill="none" stroke="#12163A" strokeWidth="2.4" strokeLinecap="square" />
        </symbol>
      </svg>

      <div className="sites" style={{ padding: '0', maxWidth: 'none', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <nav className="nav" style={{ flexShrink: 0, background: 'rgba(252,250,248,0.85)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <Link href="/" className="placa pb sm" style={{ transform: 'none' }}>Bué de Mestres</Link>
          <form className="search" style={{ margin: '0', flex: 1, maxWidth: '600px' }} action="/resultados" method="GET">
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input className="inp" name="q" placeholder="O que precisas?" defaultValue={query} style={{ flex: 1 }} />
              <input className="inp" name="onde" placeholder="Onde?" defaultValue={onde} style={{ width: '120px' }} />
              <button type="submit" className="btn b1 s">Procurar</button>
            </div>
          </form>
          <span className="sp"></span>
          <Link href="/entrar">Entrar</Link>
        </nav>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Lado Esquerdo: Lista */}
          <div style={{ width: '50%', overflowY: 'auto', padding: '24px', background: '#FCFAF8' }}>
            <h1 className="h2 h2s">Mestres encontrados perto de ti</h1>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
              <span className="btn s" style={{ background: '#12163A', color: 'white' }}>Mais bem avaliados</span>
              <span className="btn s" style={{ background: '#E6E6E6' }}>Preço mais baixo</span>
              <span className="btn s" style={{ background: '#E6E6E6' }}>Aberto agora</span>
            </div>

            <div className="cards" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {providers.map((p) => (
                <Link href={`/mestre/${p.slug}`} key={p.slug} className="ficha block cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="placa pb" style={{ transform: 'none', display: 'inline-block' }}>{p.category_name}</div>
                  <div className="fi">
                    <h3 style={{ fontSize: '20px', margin: '4px 0' }}>{p.business_name}</h3>
                    <div className="rt" style={{ marginBottom: '4px' }}><b>{p.rating_avg}</b><span>{p.rating_count} avaliações</span></div>
                    <p className="mut" style={{ marginBottom: '8px' }}>{p.district_name} {p.lat && p.lng ? "📍" : ""}</p>
                    <p style={{ fontSize: '14px', marginBottom: '8px' }}>{p.headline}</p>
                    {p.verified && (
                      <div className="tags" style={{ marginBottom: '8px' }}>
                        <svg className="selo"><use href="#selo"/></svg>Verificado
                      </div>
                    )}
                  </div>
                  <div className="acts" style={{ marginTop: '12px' }}>
                    <span className="btn b1 s" style={{ flex: 1, textAlign: 'center' }}>Chamar agora</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Lado Direito: Mapa Leaflet dinâmico */}
          <div style={{ width: '50%', position: 'relative', borderLeft: '2px solid #12163A', zIndex: 1 }}>
             <MapDynamic providers={providers} />
          </div>
        </div>
      </div>
    </>
  );
}
