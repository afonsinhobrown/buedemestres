'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { registerAction } from '@/app/actions/auth'
import { fieldErrors } from '@/lib/validators/auth'
import type { ActionState } from '@/lib/validators/auth'

function RegisterForm() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    registerAction,
    undefined
  )

  const erros = fieldErrors(state)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Criar conta</h1>
        <p className="mt-1 text-sm text-gray-500">Junte-se à Bué de Mestres gratuitamente</p>
      </div>

      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome completo
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="João da Silva"
          />
          {erros?.full_name && (
            <p className="mt-1 text-xs text-red-600">{erros.full_name[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="nome@exemplo.co.mz"
          />
          {erros?.email && (
            <p className="mt-1 text-xs text-red-600">{erros.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Palavra-passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Mínimo 8 caracteres"
          />
          {erros?.password && (
            <p className="mt-1 text-xs text-red-600">{erros.password[0]}</p>
          )}
        </div>

        {/* Código de afiliado (pre-preenchido se vier via URL) */}
        <input type="hidden" name="referral_code" value={refCode} />

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
        >
          {pending ? 'A criar conta…' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/entrar" className="font-medium text-orange-600 hover:underline">
          Entrar
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-gray-400">
        Ao registar-se aceita os nossos{' '}
        <Link href="/termos" className="underline hover:text-gray-600">Termos</Link>
        {' '}e{' '}
        <Link href="/privacidade" className="underline hover:text-gray-600">Política de Privacidade</Link>.
      </p>
    </div>
  )
}

export default function RegistarPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
