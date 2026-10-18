'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateJobStatus } from '@/app/actions/jobs'
import { toast } from 'sonner'
import { Check } from '@phosphor-icons/react'

export function JobStatusButtons({ jobId }: { jobId: string }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleComplete = async () => {
    if (!confirm('Confirmas que terminaste o trabalho? O cliente terá de validar a conclusão.')) return
    setIsUpdating(true)
    const res = await updateJobStatus(jobId, 'completed')
    setIsUpdating(false)
    
    if (res?.error) toast.error(res.error)
    else toast.success('Trabalho terminado. Aguarda a confirmação do cliente.')
  }

  return (
    <>
      <Button 
        size="sm" 
        onClick={handleComplete} 
        disabled={isUpdating}
        className="bg-[#1E7F4F] hover:bg-[#1E7F4F]/90 text-white"
      >
        <Check size={16} weight="bold" className="mr-1" /> Terminei o Trabalho
      </Button>
    </>
  )
}
