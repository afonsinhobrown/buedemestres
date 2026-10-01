'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { subscribeToPlan } from '@/app/actions/wallet'
import { toast } from 'sonner'
import Link from 'next/link'

interface Props {
  planId: number
  planName: string
  price: number
  isCurrent: boolean
  walletBalance: number
}

export function SubscribeButton({ planId, planName, price, isCurrent, walletBalance }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isCurrent) {
    return (
      <Button disabled variant="secondary" className="w-full bg-[var(--color-cal)]">
        Plano Actual
      </Button>
    )
  }

  if (price > 0 && walletBalance < price) {
    return (
      <Button asChild className="w-full bg-[var(--color-zinco)] text-white hover:bg-[var(--color-zinco)]/90">
        <Link href="/pro/carteira/carregar">
          Carregar Saldo ({price - walletBalance} MT a menos)
        </Link>
      </Button>
    )
  }

  const handleSubscribe = async () => {
    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('planId', planId.toString())

    const res = await subscribeToPlan(formData)
    setIsSubmitting(false)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success(`Activaste o plano ${planName}!`)
    }
  }

  return (
    <Button 
      onClick={handleSubscribe}
      disabled={isSubmitting} 
      className={price > 0 ? 'w-full bg-[var(--color-cobalto)] hover:bg-[var(--color-cobalto)]/90' : 'w-full'}
    >
      Activar {planName}
    </Button>
  )
}
