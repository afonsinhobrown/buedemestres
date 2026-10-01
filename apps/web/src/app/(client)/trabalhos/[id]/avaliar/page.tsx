'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { submitReview } from '@/app/actions/reviews'
import { toast } from 'sonner'
import { Star, CaretLeft } from '@phosphor-icons/react'
import Link from 'next/link'
import { use } from 'react'

export default function AvaliarTrabalhoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const jobId = resolvedParams.id
  
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      toast.error('Por favor dá uma nota de 1 a 5 estrelas.')
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('jobId', jobId)
    formData.append('rating', rating.toString())
    if (comment) formData.append('comment', comment)

    const res = await submitReview(formData)
    setIsSubmitting(false)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success('Avaliação submetida! Obrigado por ajudares a comunidade.')
      router.push('/trabalhos')
    }
  }

  return (
    <PageShell>
      <div className="max-w-md mx-auto p-4 md:p-8">
        
        <Link href="/trabalhos" className="inline-flex items-center gap-1 text-[var(--color-zinco)] hover:text-[var(--color-tinta)] mb-6 font-medium text-sm">
          <CaretLeft size={16} /> Voltar aos trabalhos
        </Link>

        <h1 className="text-2xl display-wide mb-2 text-[var(--color-tinta)]">Avaliar Mestre</h1>
        <p className="text-sm text-[var(--color-zinco)] mb-8">
          A tua avaliação é sincera e ajuda outros vizinhos a escolher os melhores profissionais.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="flex flex-col items-center justify-center p-6 bg-[var(--color-papel)] rounded-[var(--radius-foto)] border border-[var(--color-zinco-200)]">
            <label className="font-bold text-[var(--color-tinta)] mb-4">Que nota dás ao serviço?</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    size={40} 
                    weight={(hoverRating || rating) >= star ? 'fill' : 'regular'}
                    className={(hoverRating || rating) >= star ? 'text-[var(--color-amarelo)]' : 'text-[var(--color-zinco-200)]'}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div className="mt-4 text-sm font-bold text-[var(--color-cobalto)]">
                {rating === 5 ? 'Excelente!' : rating === 4 ? 'Muito Bom' : rating === 3 ? 'Razoável' : rating === 2 ? 'Fraco' : 'Muito Fraco'}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="font-bold text-sm text-[var(--color-tinta)]">Comentário (opcional mas encorajado)</label>
            <textarea
              name="comment"
              rows={4}
              placeholder="O serviço foi feito a horas? O preço foi justo? Qualidade do material..."
              className="w-full rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)] bg-[var(--color-papel)] px-3 py-2 resize-none text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || rating === 0}>
            Publicar Avaliação
          </Button>

        </form>
      </div>
    </PageShell>
  )
}
