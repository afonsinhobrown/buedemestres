import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Perguntas Frequentes · Bué de Mestres',
}

const FAQS = [
  {
    question: 'Como peço um serviço?',
    answer:
      'Na página inicial, descreve o que precisas e indica onde estás. Também podes usar o botão "Chamar Agora" para pedidos urgentes. Depois é só acompanhar as propostas e escolher o mestre.',
  },
  {
    question: 'Quando é que o mestre recebe o pagamento?',
    answer:
      'O valor fica retido na plataforma quando o serviço é pago. O mestre recebe depois de o cliente confirmar que o serviço foi concluído, ou após a resolução de uma disputa pela equipa de apoio.',
  },
  {
    question: 'Os mestres são verificados?',
    answer:
      'Os mestres passam por um processo de verificação de identidade e perfil. O selo "Verificado" indica que a verificação foi aprovada. Ainda assim, recomendamos que confirmes o âmbito e o preço antes de iniciar o serviço.',
  },
  {
    question: 'O que faço se o serviço não correr bem?',
    answer:
      'Não confirmes a conclusão do serviço e abre um pedido de ajuda em /ajuda. A equipa de apoio pode analisar o trabalho, o pagamento retido e as mensagens trocadas na plataforma.',
  },
  {
    question: 'Posso cancelar um pedido?',
    answer:
      'Sim, enquanto o serviço não tiver começado. Se o mestre já estiver a caminho ou o trabalho já tiver começado, podem aplicar-se regras de cancelamento e custos. O estado do pedido é sempre visível na aplicação.',
  },
  {
    question: 'Como funciona a carteira do mestre?',
    answer:
      'O mestre tem uma carteira na plataforma onde ficam os valores libertados. Os levantamentos estão sujeitos ao saldo disponível e às regras de aprovação da plataforma.',
  },
  {
    question: 'Como contacto o apoio?',
    answer:
      'Usa o Centro de Ajuda em /ajuda para abrir um pedido. Se já tiveres um pedido aberto, podes responder directamente na conversa.',
  },
  {
    question: 'Que meios de pagamento posso usar?',
    answer:
      'A plataforma suporta os meios disponibilizados no checkout, incluindo PaySuite e carteiras móveis. Os meios disponíveis podem variar ao longo do tempo.',
  },
]

export default function FaqPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-gray-50 p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Perguntas Frequentes</h1>
          <p className="mt-1 text-gray-500">Respostas rápidas às dúvidas mais comuns.</p>
        </div>
        <Link href="/ajuda" className="text-sm font-bold text-blue-600 hover:underline">
          Centro de Ajuda
        </Link>
      </div>

      <div className="space-y-3">
        {FAQS.map((item) => (
          <details key={item.question} className="group rounded-xl border bg-white p-5 shadow-sm">
            <summary className="cursor-pointer list-none font-semibold text-gray-900">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-gray-600">{item.answer}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-6 text-center">
        <p className="mb-3 text-sm text-blue-900">Não encontraste a resposta?</p>
        <Link
          href="/ajuda/tickets/novo"
          className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          Abrir pedido de ajuda
        </Link>
      </div>
    </div>
  )
}
