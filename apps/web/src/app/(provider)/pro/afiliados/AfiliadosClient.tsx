'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function AfiliadosClient({ referralCode }: { referralCode: string | null }) {
  const [copied, setCopied] = useState(false)
  const link = `https://buedemestres.co.mz/registo?ref=${referralCode || ''}`

  function handleCopy() {
    if (!referralCode) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Link copiado para a área de transferência!')
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm mb-8">
      <h3 className="font-bold text-xl text-gray-900 mb-4">O seu Código de Convite</h3>
      
      {referralCode ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              readOnly 
              value={link} 
              className="flex-1 p-4 border border-gray-300 rounded-lg bg-gray-50 font-mono text-gray-600 outline-none"
            />
            <button 
              onClick={handleCopy}
              className={`${copied ? 'bg-green-600' : 'bg-gray-900'} text-white px-8 py-4 rounded-lg font-bold transition whitespace-nowrap`}
            >
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Envie este link a outros profissionais. Ganha <strong className="text-gray-700">10% de comissão</strong> sobre todos os carregamentos que eles fizerem nos primeiros 90 dias!
          </p>
        </>
      ) : (
        <p className="text-gray-500">Ocorreu um erro ao carregar o seu código de convite.</p>
      )}
    </div>
  )
}
