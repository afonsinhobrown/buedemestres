import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos e Condições · Bué de Mestres',
}

export default function TermosPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-gray-50 p-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-bold uppercase tracking-wider text-orange-600">Bué de Mestres</p>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Termos e Condições de Utilização</h1>
        <p className="mb-8 text-sm text-gray-500">Última actualização: 23 de Outubro de 2026</p>

        <div className="space-y-6 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">1. Objecto</h2>
            <p>
              A plataforma Bué de Mestres liga clientes a profissionais independentes que prestam
              serviços de reparação, manutenção, explicação e outros ofícios. A plataforma facilita
              o contacto, a negociação de preço, o acompanhamento do serviço e o pagamento retido.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">2. Conta e elegibilidade</h2>
            <p>
              Para utilizar a plataforma deves ter pelo menos 18 anos e fornecer informação verdadeira,
              completa e actualizada. És responsável por manter a confidencialidade da tua palavra-passe
              e por toda a actividade realizada na tua conta.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">3. Prestadores de serviços</h2>
            <p>
              Os mestres são profissionais independentes e não são empregados, representantes ou
              agentes da Bué de Mestres. A plataforma não garante a qualidade, segurança ou legalidade
              dos serviços prestados. A verificação de identidade reduz riscos, mas não substitui a
              tua avaliação antes de contratar.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">4. Preços, pagamentos e comissões</h2>
            <p>
              O preço do serviço é acordado entre cliente e mestre na aplicação. O pagamento pode ser
              feito através dos meios disponibilizados, incluindo PaySuite e carteiras móveis. O valor
              fica retido até o cliente confirmar a conclusão do serviço, sem prejuízo dos mecanismos
              de resolução de disputas.
            </p>
            <p className="mt-2">
              A plataforma pode cobrar comissões e taxas, que são apresentadas antes da confirmação
              do pagamento. Valores, comissões e promoções podem ser alterados com aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">5. Cancelamentos, reembolsos e disputas</h2>
            <p>
              Cancelamentos e reembolsos seguem as regras apresentadas no momento do pedido e podem
              variar conforme o estado do serviço. Se houver desacordo sobre a execução ou o pagamento,
              deves abrir um pedido de ajuda no Centro de Ajuda para que a equipa analise o caso.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">6. Condutas proibidas</h2>
            <p>
              É proibido usar a plataforma para fraude, assédio, discriminação, serviços ilegais,
              manipulação de avaliações, criação de contas falsas ou tentativa de contornar os
              mecanismos de pagamento e segurança. Podemos suspender ou encerrar contas que violem
              estes termos.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">7. Responsabilidade</h2>
            <p>
              Na medida permitida por lei, a Bué de Mestres não é responsável por danos resultantes
              da execução do serviço contratado directamente com o mestre. A plataforma responde
              apenas pelos serviços que presta directamente, incluindo o funcionamento do sistema de
              pagamentos retidos e do apoio ao utilizador.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">8. Alterações e lei aplicável</h2>
            <p>
              Podemos actualizar estes termos para reflectir mudanças na plataforma ou na lei. As
              alterações relevantes serão comunicadas na aplicação. Estes termos regem-se pela
              legislação da República de Moçambique.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">9. Contacto</h2>
            <p>
              Para questões sobre estes termos, utiliza o{' '}
              <Link href="/ajuda" className="font-semibold text-blue-600 hover:underline">
                Centro de Ajuda
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="mt-8 border-t pt-6 text-sm">
          <Link href="/privacidade" className="font-semibold text-blue-600 hover:underline">
            Consultar a Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  )
}
