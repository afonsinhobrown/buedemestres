'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateJobStatus } from '@/app/actions/jobs'
import { toast } from 'sonner'
import { Check } from '@phosphor-icons/react'

export function JobStatusButtons({ jobId, currentStatus }: { jobId: string, currentStatus: string }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleComplete = async () => {
    if (!confirm('O trabalho foi concluído satisfatoriamente?')) return
    setIsUpdating(true)
    const res = await updateJobStatus(jobId, 'completed')
    setIsUpdating(false)
    
    if (res?.error) toast.error(res.error)
    else toast.success('Trabalho marcado como concluído!')
  }

  return (
    <>
      <Button 
        size="sm" 
        onClick={handleComplete} 
        disabled={isUpdating}
        className="bg-[#1E7F4F] hover:bg-[#1E7F4F]/90 text-white"
      >
        <Check size={16} weight="bold" className="mr-1" /> Marcar Concluído
      </Button>
    </>
  )
}
