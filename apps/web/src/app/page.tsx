import React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { AdsRail } from '@/components/ads/AdsRail';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Fetch real providers from the DB!
  const res = await db.query(`
    SELECT pp.slug, pp.business_name, pp.headline, pp.rating_avg, pp.rating_count,
           pp.verification, d.name as district_name, p.name as province_name,
           c.name as category_name,
           CASE c.slug
             WHEN 'mecanico' THEN 'pb'
             WHEN 'explicador' THEN 'py'
             WHEN 'carpinteiro' THEN 'po'
             ELSE 'pb'
           END as color_class
    FROM provider_profiles pp
    JOIN districts d ON pp.district_id = d.id
    JOIN provinces p ON d.province_id = p.id
    JOIN categories c ON pp.primary_category_id = c.id
    WHERE pp.is_published = true
    ORDER BY pp.rating_avg DESC
    LIMIT 3
  `);
  const providers = res.rows;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="selo" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10.5" fill="#FFC61A" stroke="#12163A" strokeWidth="2" />
          <circle cx="12" cy="12" r="7.6" fill="none" stroke="#12163A" strokeWidth="1" strokeDasharray="2 1.6" />
          <path d="M7.6 12.4l3 3 5.8-6.4" fill="none" stroke="#12163A" strokeWidth="2.4" strokeLinecap="square" />
        </symbol>
      </svg>

      <nav className="nav nav--flush">
        <div className="shell" style={{ display: 'flex', alignItems: 'center', gap: 26, width: '100%' }}>
          <Link href="/" className="placa pb sm" style={{ transform: 'none' }}>Bué de Mestres</Link>
          <Link href="#como-funciona">Como funciona</Link>
          <Link href="#para-mestres">Para mestres</Link>
          <Link href="/ajuda">Ajuda</Link>
          <span className="sp"></span>
          <Link href="/entrar">Entrar</Link>
          <Link href="/registo" className="btn b1 s">Criar a minha placa</Link>
        </div>
      </nav>

      <div className="shell">
        <section aria-label="Início" className="hero">
          <div className="hero-copy">
            <p className="kicker">Maputo · Ofícios verificados</p>
            <h1 className="h1">Precisas de um mestre? Bué deles, no teu bairro.</h1>
            <p className="hero-sub">
              Descreves o que precisas, o mestre mais perto aceita e tu pagas só depois
              do serviço feito.
            </p>
            <form className="search search--row" action="/resultados" method="GET">
              <div>
                <label className="lbl" htmlFor="q1">Preciso de</label>
                <input className="inp" id="q1" name="q" placeholder="mecânico, explicador de Matemática…" required />
              </div>
              <div>
                <label className="lbl" htmlFor="w1">Onde</label>
                <input className="inp" id="w1" name="onde" defaultValue="Polana, Maputo" required />
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <button type="submit" className="btn b1">Procurar mestres</button>
                <Link href="/chamar" className="btn" style={{ backgroundColor: '#e53e3e', color: 'white', fontWeight: 'bold' }}>
                  🚨 CHAMAR AGORA (URGÊNCIA)
                </Link>
              </div>
            </form>
            <ul className="hero-stats">
              <li><b>6</b><span>ofícios registados</span></li>
              <li><b>3</b><span>mestres verificados</span></li>
              <li><b>4.8</b><span>avaliação média</span></li>
            </ul>
          </div>

          <Link href="/resultados" className="wall block" aria-label="Ofícios">
            <div className="placa pb hover:scale-105 transition-transform" style={{ gridColumn: 'span 7', gridRow: 'span 2', '--r': '-.6deg', '--i': 0, fontSize: '58px' } as React.CSSProperties}>Mecânico<small>Pneus, travões, electricidade auto</small></div>
            <div className="placa py hover:scale-105 transition-transform" style={{ gridColumn: 'span 5', gridRow: 'span 1', '--r': '.7deg', '--i': 1 } as React.CSSProperties}>Explicador<small>Todas as classes</small></div>
            <div className="placa po hover:scale-105 transition-transform" style={{ gridColumn: 'span 5', gridRow: 'span 2', '--r': '.5deg', '--i': 2, fontSize: '44px' } as React.CSSProperties}>Carpinteiro<small>Portas e móveis</small></div>
            <div className="placa pp hover:scale-105 transition-transform" style={{ gridColumn: 'span 4', '--r': '-.5deg', '--i': 3, fontSize: '34px' } as React.CSSProperties}>Pedreiro</div>
            <div className="placa pb hover:scale-105 transition-transform" style={{ gridColumn: 'span 8', '--r': '.4deg', '--i': 4 } as React.CSSProperties}>Electricista<small>Instalações e avarias</small></div>
            <div className="placa pp hover:scale-105 transition-transform" style={{ gridColumn: 'span 7', '--r': '-.4deg', '--i': 5, fontSize: '34px' } as React.CSSProperties}>Canalizador</div>
          </Link>
        </section>

        <h2 className="h2 h2s h2s--flush">Mestres verificados perto de ti</h2>
        <div className="cards cards--flush">
          {providers.length > 0 ? (
            providers.map((p) => (
              <Link href={`/mestre/${p.slug}`} key={p.slug} className="ficha block cursor-pointer hover:shadow-lg transition-shadow">
                <div className={`placa ${p.color_class}`} style={{ transform: 'none' }}>{p.category_name}<small>{p.headline}</small></div>
                <div className="fi">
                  <h3>{p.business_name}</h3>
                  <div className="rt"><b>{p.rating_avg}</b><span>{p.rating_count} avaliações</span></div>
                  <p className="mut">{p.district_name}</p>
                  {p.verification === 'approved' && (
                    <div className="tags">
                      <svg className="selo"><use href="#selo"/></svg>Verificado
                    </div>
                  )}
                  <p className="pr">Ver perfil</p>
                </div>
                <div className="acts">
                  <span className="btn b2 s">WhatsApp</span>
                  <span className="btn b1 s">Chamar agora</span>
                </div>
              </Link>
            ))
          ) : (
            <p>Nenhum mestre encontrado.</p>
          )}
        </div>
      </div>

      {/* Em ecrãs largos a publicidade vai para as colunas laterais
          (ver AdColumn), por isso aqui esconde-se para não duplicar. */}
      <div className="ads-home">
        <AdsRail />
      </div>

      <div className="shell">
        <h2 id="como-funciona" className="h2 h2s h2s--flush">Como funciona</h2>
        <div className="how">
          <div><b>1</b><h3>Descreve o que precisas</h3><p>Indica o problema e onde estás. Se for urgente, o pedido segue logo para os mestres mais próximos.</p></div>
          <div><b>2</b><h3>Um mestre aceita</h3><p>Vês quem é, a avaliação e a chegada no mapa. O preço é combinado na aplicação.</p></div>
          <div><b>3</b><h3>Pagas e avaliaste</h3><p>O valor fica retido até confirmares o serviço. Depois, avalias o mestre.</p></div>
        </div>

        <div id="para-mestres" className="placa py band" style={{ transform: 'rotate(-.5deg)' }}>
          Tens um ofício? Cria a tua placa.
          <Link href="/registo" className="btn b1 ml-4">Criar a minha placa</Link>
        </div>
      </div>

      <div className="strip"></div>
      
      <div className="shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
        <h3 style={{ fontSize: '14px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', fontWeight: 600 }}>
          Plataforma gerida por profissionais certificados
        </h3>
        <a href="https://www.credential.net/53726c6f-a162-47f9-aaba-4e2988f78240" target="_blank" rel="noopener noreferrer" className="hover:scale-105 transition-transform">
          <img 
            src="https://api.accredible.com/v1/credentials/u4gkf9oq/artifact/certificate?artifact_format=png&variant=medium" 
            alt="Google AI-Powered Shopping ads Certification" 
            style={{ height: '140px', borderRadius: '8px', objectFit: 'contain' }} 
          />
        </a>
      </div>

      <footer className="foot">
        <div className="shell foot-in">
          <span>Bué de Mestres</span>
          <span>Termos, privacidade e ajuda</span>
        </div>
      </footer>
    </>
  );
}