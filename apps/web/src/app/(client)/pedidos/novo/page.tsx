'use client'

import { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageShell } from '@/components/layout/PageShell'
import { Camera, CalendarBlank, CaretLeft } from '@phosphor-icons/react'
import { createRequest } from '@/app/actions/requests'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PickedLocation } from '@/components/LocationPicker'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-xl border border-[var(--color-zinco-200)] bg-[var(--color-papel)]" />,
})

function NewRequestForm() {
  const router = useRouter()
  // Use native search params to avoid Next.js static generation de-opts
  const [mestreSlug, setMestreSlug] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setMestreSlug(params.get('mestre'))
    }
  }, [])

  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [location, setLocation] = useState<PickedLocation | null>(null)

  const handlePhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 5 - photos.length)
    if (selected.length === 0) return
    setPhotos((current) => [
      ...current,
      ...selected.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ].slice(0, 5))
    event.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((current) => {
      const photo = current[index]
      if (photo) URL.revokeObjectURL(photo.url)
      return current.filter((_, i) => i !== index)
    })
  }

  // Rascunho de pedido
  const [formData, setFormData] = useState({
    title: '',
    categoryId: '1', // Default auto/mecânico para a demo
    description: '',
    preferredDate: '',
    budgetMin: '',
    budgetMax: '',
  })

  useEffect(() => {
    // Recuperar rascunho
    const draft = localStorage.getItem('buedemestres_request_draft')
    if (draft) {
      try {
        setFormData(JSON.parse(draft))
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    // Guardar rascunho
    localStorage.setItem('buedemestres_request_draft', JSON.stringify(formData))
  }, [formData])

  const nextStep = () => setStep(s => Math.min(s + 1, 4))
  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const submitData = new FormData()
    Object.entries(formData).forEach(([k, v]) => submitData.append(k, v))
    photos.forEach((photo) => submitData.append('photos', photo.file))
    if (location) {
      submitData.append('address', location.address)
      submitData.append('lat', String(location.lat))
      submitData.append('lng', String(location.lng))
    }
    if (mestreSlug) {
      // Idealmente resolveriamos o ID real do provider pelo slug
      // submitData.append('targetProviderId', targetId)
    }

    const res = await createRequest(null, submitData)
    
    setIsSubmitting(false)
    if (res?.error) {
      toast.error(res.error)
    } else if (res?.fieldErrors) {
      toast.error("Verifica os campos do formulário.")
    } else if (res?.success) {
      localStorage.removeItem('buedemestres_request_draft')
      toast.success("Pedido publicado!")
      router.push('/pedidos')
    }
  }

  return (
    <PageShell noNav>
      <div className="flex flex-col h-screen max-h-screen bg-[var(--color-cal)]">
        {/* Header Assistente */}
        <header className="flex items-center px-4 h-[60px] bg-[var(--color-papel)] border-b border-[var(--color-zinco-200)] shrink-0">
          <button onClick={prevStep} disabled={step === 1} className="p-2 -ml-2 disabled:opacity-30">
            <CaretLeft size={24} />
          </button>
          <div className="flex-1 text-center font-bold text-[var(--color-tinta)]">
            Passo {step} de 4
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Progress bar */}
        <div className="h-1 w-full bg-[var(--color-zinco-200)]">
          <div 
            className="h-full bg-[var(--color-cobalto)] transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Conteúdo scrollable */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
          <form id="requestForm" onSubmit={handleSubmit} className="w-full max-w-lg space-y-6">
            
            <div className={cn("space-y-6", step !== 1 && "hidden")}>
              <h2 className="text-2xl display-wide">Qual é o problema?</h2>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-[var(--color-tinta)]">Categoria</label>
                  <select 
                    name="categoryId" 
                    value={formData.categoryId} 
                    onChange={handleChange}
                    className="h-[52px] rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)] bg-[var(--color-papel)] px-3"
                  >
                    <option value="1">Automóvel (Mecânico, etc)</option>
                    <option value="2">Construção e Reparações</option>
                    <option value="3">Casa e Limpeza</option>
                  </select>
                </div>

                <Input
                  label="Título curto"
                  name="title"
                  placeholder="Ex: Motor a fazer barulho"
                  value={formData.title}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={cn("space-y-6", step !== 2 && "hidden")}>
              <h2 className="text-2xl display-wide">Mostra-nos.</h2>
              
              <div className="space-y-4">
                <label
                  htmlFor="request-photos"
                  className="border-2 border-dashed border-[var(--color-zinco-200)] rounded-[var(--radius-foto)] p-8 flex flex-col items-center justify-center text-center gap-3 bg-[var(--color-papel)] cursor-pointer hover:bg-[var(--color-cal)]"
                >
                  <Camera size={40} className="text-[var(--color-zinco)]" />
                  <div>
                    <p className="font-bold">Tira uma foto ou escolhe da galeria</p>
                    <p className="text-sm text-[var(--color-zinco)]">Até 5 fotografias.</p>
                  </div>
                  <input
                    id="request-photos"
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handlePhotos}
                  />
                </label>

                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <div key={photo.url} className="relative overflow-hidden rounded-xl border border-[var(--color-zinco-200)] bg-white">
                        <img src={photo.url} alt={`Fotografia ${index + 1}`} className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-[var(--color-tinta)]">Descrição (opcional se meteres foto)</label>
                  <textarea
                    name="description"
                    rows={4}
                    placeholder="Explica com as tuas palavras..."
                    className="w-full rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)] bg-[var(--color-papel)] px-3 py-2 resize-none"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className={cn("space-y-6", step !== 3 && "hidden")}>
              <h2 className="text-2xl display-wide">Onde e quando?</h2>
              
              <div className="space-y-4">
                {step === 3 && <LocationPicker value={location} onChange={setLocation} />}

                <div className="relative">
                  <Input
                    label="Data preferida"
                    name="preferredDate"
                    type="date"
                    className="pl-9"
                    value={formData.preferredDate}
                    onChange={handleChange}
                  />
                  <CalendarBlank className="absolute left-3 top-[34px] text-[var(--color-zinco)]" size={20} />
                </div>
              </div>
            </div>

            <div className={cn("space-y-6", step !== 4 && "hidden")}>
              <h2 className="text-2xl display-wide">Revisão</h2>
              
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--color-zinco-200)] bg-[#fff8df] p-4 text-sm text-[var(--color-tinta)]">
                  <strong>O preço é definido pelo mestre.</strong>
                  <p className="mt-1 text-[var(--color-zinco)]">
                    Depois de publicares o pedido, o mestre responde com o orçamento. Podes aceitar ou recusar.
                  </p>
                </div>

                <div className="bg-[var(--color-papel)] p-4 rounded-[var(--radius-foto)] border border-[var(--color-zinco-200)] space-y-2 mt-6">
                  <h3 className="font-bold">Resumo</h3>
                  <p className="text-sm"><strong>O que:</strong> {formData.title || '(sem título)'}</p>
                  <p className="text-sm"><strong>Descrição:</strong> {formData.description || '(sem descrição)'}</p>
                  {mestreSlug && (
                    <p className="text-sm text-[var(--color-cobalto)] font-medium mt-2">
                      Pedido directo para {mestreSlug}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </form>
        </main>

        {/* Footer Assistente */}
        <footer className="p-4 bg-[var(--color-papel)] border-t border-[var(--color-zinco-200)] flex justify-end gap-2 shrink-0 pb-safe">
          {step < 4 ? (
            <Button onClick={nextStep} className="w-full md:w-auto" size="lg">Continuar</Button>
          ) : (
            <Button 
              type="submit" 
              form="requestForm" 
              className="w-full md:w-auto" 
              size="lg"
              disabled={isSubmitting}
            >
              Publicar pedido
            </Button>
          )}
        </footer>
      </div>
    </PageShell>
  )
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">A carregar...</div>}>
      <NewRequestForm />
    </Suspense>
  )
}
