'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { alternarMembroEquipa, criarMembroEquipa, redefinirSenhaMembro } from './actions'

const ROLES = [
  { value: 'support', label: 'Apoio ao Cliente' },
  { value: 'moderator', label: 'Moderador' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'admin', label: 'Administrador' },
  { value: 'superadmin', label: 'Superadmin' },
]

export function NovoMembroForm() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(formData: FormData) {
    setSaving(true)
    const res = await criarMembroEquipa(formData)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Membro da equipa criado com sucesso.')
    setOpen(false)
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition"
      >
        {open ? 'Cancelar' : '+ Criar Membro'}
      </button>

      {open && (
        <form
          action={submit}
          className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nome completo</label>
            <input name="full_name" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Ana Silva" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
            <input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ana@buedemestres.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Palavra-passe inicial</label>
            <input name="password" type="password" required minLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Papel</label>
            <select name="staff_role" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold"
            >
              {saving ? 'A criar...' : 'Criar conta de gestão'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function MembroAcoes({ profileId, isActive }: { profileId: string; isActive: boolean }) {
  const [sending, setSending] = useState(false)

  async function toggle() {
    setSending(true)
    const res = await alternarMembroEquipa(profileId, !isActive)
    setSending(false)
    if (res.error) toast.error(res.error)
    else toast.success(isActive ? 'Membro suspenso.' : 'Membro reativado.')
  }

  async function resetPassword() {
    if (typeof window === 'undefined') return
    const password = window.prompt('Nova palavra-passe (mínimo 8 caracteres):')
    if (!password) return
    setSending(true)
    const res = await redefinirSenhaMembro(profileId, password)
    setSending(false)
    if (res.error) toast.error(res.error)
    else toast.success('Palavra-passe redefinida. O utilizador terá de a alterar no próximo login.')
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button onClick={resetPassword} disabled={sending} className="text-blue-600 font-bold hover:underline disabled:opacity-50">
        Redefinir senha
      </button>
      <button
        onClick={toggle}
        disabled={sending}
        className={isActive ? 'text-red-600 font-bold hover:underline disabled:opacity-50' : 'text-green-600 font-bold hover:underline disabled:opacity-50'}
      >
        {isActive ? 'Suspender' : 'Reativar'}
      </button>
    </div>
  )
}
