'use client'

import { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { PageShell } from '@/components/layout/PageShell'
import { Camera, CalendarBlank, CaretLeft } from '@phosphor-icons/react'
import { createRequest } from '@/app/actions/requests'
import { toast, Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import type { PickedLocation } from '@/components/LocationPicker'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-xl border border-[var(--color-zinco-200)] bg-[var(--color-papel)]" />,
})

async function compressImage(file: File): Promise<File> {
  if (file.size <= 500 * 1024) return file

  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = 1400
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.68))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

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
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handlePhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 5 - photos.length)
    if (selected.length === 0) return
    setProcessingPhotos(true)
    try {
      const prepared = await Promise.all(selected.map(compressImage))
      setPhotos((current) => [
        ...current,
        ...prepared.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ].slice(0, 5))
    } finally {
      setProcessingPhotos(false)
      event.target.value = ''
    }
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
    setSubmitError(null)

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

    try {
      const res = await createRequest(null, submitData)
      if (res?.error) {
        setSubmitError(res.error)
        toast.error(res.error)
      } else if (res?.fieldErrors) {
        const firstError = Object.values(res.fieldErrors).flat().find(Boolean)
        const message = firstError || 'Verifica os campos do formulário.'
        setSubmitError(message)
        toast.error(message)
      } else if (res?.success) {
        localStorage.removeItem('buedemestres_request_draft')
        toast.success('Pedido publicado!')
        if (res.warning) toast.warning(res.warning, { duration: 8000 })
        router.push('/pedidos')
      }
    } catch (error) {
      console.error('Erro ao publicar pedido:', error)
      const message = 'Não foi possível publicar o pedido. Tenta novamente.'
      setSubmitError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageShell noNav>
      <Toaster position="top-right" richColors />
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
                    <p className="font-bold">{processingPhotos ? 'A preparar fotografias…' : 'Tira uma foto ou escolhe da galeria'}</p>
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
                {submitError && (
                  <div className="rounded-xl border border-[var(--color-oxido)] bg-red-50 p-4 text-sm font-medium text-[var(--color-oxido)]">
                    {submitError}
                  </div>
                )}
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
            <button type="button" onClick={nextStep} className="btn b1 w-full md:w-auto">
              Continuar
            </button>
          ) : (
            <button
              type="submit"
              form="requestForm"
              className="btn b1 w-full md:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'A publicar…' : 'Publicar pedido'}
            </button>
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
