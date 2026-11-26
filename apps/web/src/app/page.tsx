import type { Metadata } from 'next'
import Link from 'next/link'
import { AdsRail } from '@/components/ads/AdsRail'
import { loadDiscoveryData } from '@/lib/discovery-server'
import { getOptionalSession } from '@/lib/session'
import DiscoveryView from './resultados/DiscoveryView'
import './resultados/discovery.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bué de Mestres — Encontrar mestres perto de ti',
  description:
    'Precisas de um mestre? Encontra mecânicos, electricistas, canalizadores, explicadores e outros profissionais verificados perto de ti, em Moçambique.',
}

export default async function HomePage() {
  const data = await loadDiscoveryData({})
  const session = await getOptionalSession().catch(() => null)

  return (
    <DiscoveryView
      {...data}
      q=""
      verifiedOnly={false}
      availableOnly={false}
      isAuthenticated={Boolean(session?.userId)}
      home
    >
      <div className="dx-home-content">
        <section className="shell dx-home-intro">
          <p className="kicker">Moçambique · Ofícios verificados</p>
          <h2 className="h2">Precisas de um mestre? Bué deles, no teu bairro.</h2>
          <p className="mut">
            Descreves o que precisas, o mestre mais perto aceita e pagas só depois do
            serviço feito. Sem intermediários e sem surpresas.
          </p>
        </section>

        <section className="shell">
          <h2 id="como-funciona" className="h2 h2s h2s--flush">
            Como funciona
          </h2>
          <div className="how">
            <div>
              <b>1</b>
              <h3>Descreve o que precisas</h3>
              <p>
                Indica o problema e onde estás. Se for urgente, o pedido segue logo para
                os mestres mais próximos.
              </p>
            </div>
            <div>
              <b>2</b>
              <h3>Um mestre aceita</h3>
              <p>
                Vês quem é, a avaliação e a chegada no mapa. O preço é combinado na
                aplicação.
              </p>
            </div>
            <div>
              <b>3</b>
              <h3>Pagas e avalias</h3>
              <p>
                O valor fica retido até confirmares o serviço. Depois, avalias o mestre.
              </p>
            </div>
          </div>
        </section>

        <div className="shell">
          <div
            id="para-mestres"
            className="placa py band"
            style={{ transform: 'rotate(-.5deg)' }}
          >
            Tens um ofício? Cria a tua placa.
            <Link href="/registar?redirect=/pro/activar" className="btn b1 ml-4">
              Criar a minha placa
            </Link>
          </div>
        </div>

        <AdsRail />

        <footer className="foot">
          <div className="shell foot-in">
            <span>Bué de Mestres</span>
            <span style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link href="/termos">Termos</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/ajuda">Ajuda</Link>
            </span>
          </div>
        </footer>
      </div>
    </DiscoveryView>
  )
}
