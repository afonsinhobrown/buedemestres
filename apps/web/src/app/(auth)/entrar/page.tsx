'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'
import { fieldErrors } from '@/lib/validators/auth'
import type { ActionState } from '@/lib/validators/auth'

export default function EntrarPage() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    loginAction,
    undefined
  )

  const erros = fieldErrors(state)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h1>
        <p className="mt-1 text-sm text-gray-500">Entre na sua conta Bué de Mestres</p>
      </div>

      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <form action={action} className="space-y-5">
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
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="••••••••"
          />
          {erros?.password && (
            <p className="mt-1 text-xs text-red-600">{erros.password[0]}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Link href="/recuperar" className="text-xs text-orange-600 hover:underline">
            Esqueceu a palavra-passe?
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
        >
          {pending ? 'A entrar…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Ainda não tem conta?{' '}
        <Link href="/registar" className="font-medium text-orange-600 hover:underline">
          Registar-se
        </Link>
      </p>
    </div>
  )
}
