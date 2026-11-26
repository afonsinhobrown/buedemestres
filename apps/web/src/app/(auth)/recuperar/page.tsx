import Link from 'next/link'

export const metadata = {
  title: 'Recuperar palavra-passe — Bué de Mestres',
}

export default function RecuperarPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Recuperar palavra-passe</h1>
      <p className="mt-3 text-sm text-gray-600">
        Para recuperar o acesso, fala com o apoio da Bué de Mestres e indica o e-mail da tua conta.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link href="/ajuda" className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
          Falar com o apoio
        </Link>
        <Link href="/entrar" className="text-sm font-medium text-gray-600 underline">
          Voltar ao login
        </Link>
      </div>
    </div>
  )
}
