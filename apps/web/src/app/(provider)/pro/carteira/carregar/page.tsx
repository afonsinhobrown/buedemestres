'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTopUpPayment } from '@/app/actions/wallet'
import { toast } from 'sonner'
import { CaretLeft, Wallet } from '@phosphor-icons/react'
import Link from 'next/link'

export default function CarregarCarteiraPage() {
  const router = useRouter()
  const [amount, setAmount] = useState('500')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const presetAmounts = [100, 500, 1500, 5000]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const formData = new FormData()
    formData.append('amount', amount)

    const res = await createTopUpPayment(formData)
    
    setIsSubmitting(false)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("Carregamento efectuado com sucesso!")
      router.push('/pro/carteira')
    }
  }

  return (
    <PageShell>
      <div className="max-w-md mx-auto p-4 md:p-8">
        
        <Link href="/pro/carteira" className="inline-flex items-center gap-1 text-[var(--color-zinco)] hover:text-[var(--color-tinta)] mb-6 font-medium text-sm">
          <CaretLeft size={16} /> Voltar à carteira
        </Link>

        <h1 className="text-2xl display-wide mb-2 text-[var(--color-tinta)]">Carregar Saldo</h1>
        <p className="text-sm text-[var(--color-zinco)] mb-8">
          Adiciona fundos à tua carteira para subscreveres planos e destacares a tua placa.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-3">
            <label className="font-bold text-sm text-[var(--color-tinta)]">Valor rápido</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {presetAmounts.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className={`h-12 rounded-[var(--radius-controlo)] font-bold text-sm transition-colors border ${
                    amount === val.toString() 
                      ? 'bg-[var(--color-cobalto)] text-white border-[var(--color-cobalto)]'
                      : 'bg-[var(--color-papel)] text-[var(--color-tinta)] border-[var(--color-zinco-200)] hover:border-[var(--color-cobalto)]'
                  }`}
                >
                  {val} MT
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
             <Input
                label="Ou escreve outro valor (Mínimo 50 MT)"
                type="number"
                name="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="50"
             />
          </div>

          <div className="bg-[var(--color-amarelo)]/10 border border-[var(--color-amarelo)] rounded-[var(--radius-controlo)] p-4 flex gap-3 text-sm text-[var(--color-tinta)]">
            <Wallet size={24} className="shrink-0 text-[var(--color-amarelo)] mt-0.5" weight="fill" />
            <div>
              <span className="font-bold">Aviso (Fase 4):</span> O pagamento via M-Pesa está oculto temporariamente. 
              Ao clicares em "Confirmar", o teu saldo será imediatamente carregado via método "manual" (modo simulação).
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            Confirmar Pagamento
          </Button>

        </form>
      </div>
    </PageShell>
  )
}
