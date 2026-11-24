import Link from 'next/link'

const STEPS = [
  {
    number: '1',
    title: 'Descreve o que precisas',
    body: 'Indica o problema e onde estás. Se for urgente, o pedido segue logo para os mestres mais próximos.',
  },
  {
    number: '2',
    title: 'Um mestre aceita',
    body: 'Vês quem é, a avaliação e a chegada no mapa. O preço é combinado na aplicação.',
  },
  {
    number: '3',
    title: 'Pagas e avalias',
    body: 'O valor fica retido até confirmares o serviço. Depois, avalias o mestre.',
  },
]

export const metadata = {
  title: 'Como funciona — Bué de Mestres',
  description: 'Pedir um mestre, acompanhar o serviço e pagar com segurança.',
}

export default function ComoFuncionaPage() {
  return (
    <div className="new-page">
      <section className="new-hero">
        <span className="new-kicker">Bué de Mestres</span>
        <h1>Um mestre certo, sem complicações.</h1>
        <p>Procuras no mapa, escolhes o profissional e só pagas depois do serviço feito.</p>
        <div className="new-actions">
          <Link href="/" className="bdm-top-cta">Explorar o mapa</Link>
          <Link href="/chamar" className="new-secondary">Chamar agora</Link>
        </div>
      </section>

      <section className="new-grid">
        {STEPS.map((step) => (
          <article key={step.number} className="new-card">
            <span className="new-step">{step.number}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="new-banner">
        <div>
          <h2>Tens um ofício?</h2>
          <p>Cria a tua placa, publica os teus serviços e recebe pedidos perto de ti.</p>
        </div>
        <Link href="/registar?redirect=/pro/activar" className="bdm-top-cta">Criar a minha placa</Link>
      </section>
    </div>
  )
}
