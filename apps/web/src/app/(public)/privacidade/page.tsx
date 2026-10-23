import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade · Bué de Mestres',
}

export default function PrivacidadePage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-gray-50 p-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-bold uppercase tracking-wider text-orange-600">Bué de Mestres</p>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Política de Privacidade</h1>
        <p className="mb-8 text-sm text-gray-500">Última actualização: 23 de Outubro de 2026</p>

        <div className="space-y-6 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">1. Quem somos</h2>
            <p>
              A Bué de Mestres é uma plataforma que liga clientes a profissionais independentes em
              Moçambique. Esta política explica que dados recolhemos, porque os usamos e que direitos
              tens sobre eles.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">2. Dados que recolhemos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Dados de conta: nome, e-mail, número de telemóvel e palavra-passe protegida.</li>
              <li>Dados de perfil profissional: ofício, descrição, localização, experiência e documentos de verificação.</li>
              <li>Dados de pedidos e serviços: morada, descrição do problema, fotografias, mensagens, estados e avaliações.</li>
              <li>Dados de pagamento: referências de transacção, valores e estado do pagamento. Não armazenamos o PIN ou a palavra-passe da carteira móvel.</li>
              <li>Dados técnicos: endereço IP, tipo de dispositivo, registos de acesso e identificadores de notificações.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">3. Para que usamos os dados</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Criar e gerir a tua conta e autenticar o acesso.</li>
              <li>Ligar clientes e mestres, calcular distâncias e acompanhar o serviço.</li>
              <li>Processar pagamentos, reembolsos, comissões e prevenir fraude.</li>
              <li>Prestar apoio, resolver disputas e cumprir obrigações legais.</li>
              <li>Enviar notificações sobre pedidos, mensagens e estados do serviço.</li>
              <li>Melhorar a segurança e o funcionamento da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">4. Com quem partilhamos</h2>
            <p>
              Partilhamos apenas os dados necessários com o mestre ou cliente envolvido no serviço,
              com prestadores de pagamento (como PaySuite e carteiras móveis), com fornecedores de
              infraestrutura (alojamento, base de dados e notificações) e com autoridades quando a lei
              o exigir. Não vendemos dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">5. Conservação e segurança</h2>
            <p>
              Conservamos os dados enquanto a conta estiver activa e pelo período necessário para
              cumprir obrigações legais, fiscais e de resolução de disputas. Aplicamos medidas técnicas
              e organizativas para proteger os dados, incluindo acesso restrito, ligações seguras e
              registo de actividades sensíveis.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">6. Os teus direitos</h2>
            <p>
              Podes pedir acesso, correcção, actualização ou eliminação dos teus dados, bem como
              opor-te a determinados tratamentos. Para exercer estes direitos, abre um pedido no{' '}
              <Link href="/ajuda" className="font-semibold text-blue-600 hover:underline">
                Centro de Ajuda
              </Link>
              . Alguns dados podem ser conservados quando a lei exige.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">7. Cookies e notificações</h2>
            <p>
              Usamos cookies essenciais para manter a sessão e preferências. Com o teu consentimento,
              podemos usar notificações push para alertar sobre pedidos e mensagens. Podes desactivar
              as notificações nas definições do dispositivo.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-gray-900">8. Alterações</h2>
            <p>
              Podemos actualizar esta política para reflectir mudanças na plataforma ou na lei. As
              alterações relevantes serão comunicadas na aplicação.
            </p>
          </section>
        </div>

        <div className="mt-8 border-t pt-6 text-sm">
          <Link href="/termos" className="font-semibold text-blue-600 hover:underline">
            Consultar os Termos e Condições
          </Link>
        </div>
      </div>
    </div>
  )
}
