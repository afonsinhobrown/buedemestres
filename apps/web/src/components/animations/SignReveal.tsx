'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SignRevealProps {
  children: React.ReactNode
  className?: string
  delayMs?: number
}

export function SignReveal({ children, className, delayMs = 0 }: SignRevealProps) {
  const [shouldPaint, setShouldPaint] = useState(false)
  const [hasRevealed, setHasRevealed] = useState(false)

  useEffect(() => {
    // Verificar se já animámos nesta sessão
    const hasAnimated = sessionStorage.getItem('buedemestres_animated')
    
    if (!hasAnimated) {
      // Primeira vez na sessão: animar!
      const timer = setTimeout(() => {
        setShouldPaint(true)
        // Guardar logo para não repetir
        sessionStorage.setItem('buedemestres_animated', 'true')
        
        // Limpar a classe após a animação (450ms no CSS)
        setTimeout(() => setHasRevealed(true), 500)
      }, delayMs)
      
      return () => clearTimeout(timer)
    } else {
      // Já animou antes, mostrar instantaneamente
      setHasRevealed(true)
    }
  }, [delayMs])

  return (
    <div 
      className={cn(
        hasRevealed ? "" : "sign-reveal",
        shouldPaint && !hasRevealed ? "paint" : "",
        className
      )}
    >
      {children}
    </div>
  )
}
