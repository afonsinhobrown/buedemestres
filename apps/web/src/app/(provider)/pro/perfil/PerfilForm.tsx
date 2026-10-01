'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { updateProviderProfile } from './actions'

const perfilSchema = z.object({
  business_name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  headline: z.string().optional(),
  bio: z.string().optional(),
  whatsapp: z.string().regex(/^\+258 8\d{1} \d{3} \d{4}$/, 'Formato inválido. Use +258 8X XXX XXXX').optional().or(z.literal('')),
  district_id: z.coerce.number().positive('Selecione um distrito'),
  years_experience: z.coerce.number().min(0, 'Anos de experiência inválidos').optional(),
})

type PerfilFormValues = z.infer<typeof perfilSchema>

type Props = {
  initialData: any
  districts: { id: number; name: string }[]
}

export function PerfilForm({ initialData, districts }: Props) {
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PerfilFormValues>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      business_name: initialData?.business_name || '',
      headline: initialData?.headline || '',
      bio: initialData?.bio || '',
      whatsapp: initialData?.whatsapp || '',
      district_id: initialData?.district_id || '',
      years_experience: initialData?.years_experience || '',
    },
  })

  async function onSubmit(data: PerfilFormValues) {
    setIsPending(true)
    const formData = new FormData()
    formData.append('business_name', data.business_name)
    if (data.headline) formData.append('headline', data.headline)
    if (data.bio) formData.append('bio', data.bio)
    if (data.whatsapp) formData.append('whatsapp', data.whatsapp)
    formData.append('district_id', data.district_id.toString())
    if (data.years_experience !== undefined) formData.append('years_experience', data.years_experience.toString())

    const result = await updateProviderProfile(formData)
    
    setIsPending(false)
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Perfil atualizado com sucesso!')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Nome da Empresa / Profissional <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            {...register('business_name')}
            className="w-full p-3 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
            placeholder="Ex: João Canalizador" 
          />
          {errors.business_name && <p className="text-red-500 text-sm mt-1">{errors.business_name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">WhatsApp</label>
          <input 
            type="tel" 
            {...register('whatsapp')}
            className="w-full p-3 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
            placeholder="+258 84 123 4567" 
          />
          {errors.whatsapp && <p className="text-red-500 text-sm mt-1">{errors.whatsapp.message}</p>}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">Título Curto</label>
        <input 
          type="text" 
          {...register('headline')}
          className="w-full p-3 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
          placeholder="Ex: Canalizador Especialista com 10 anos de experiência" 
        />
        {errors.headline && <p className="text-red-500 text-sm mt-1">{errors.headline.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">Biografia</label>
        <textarea 
          {...register('bio')}
          className="w-full p-3 border rounded-lg h-32 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none" 
          placeholder="Descreva os seus serviços, experiência e o que o diferencia..."
        ></textarea>
        {errors.bio && <p className="text-red-500 text-sm mt-1">{errors.bio.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Distrito de Actuação principal <span className="text-red-500">*</span></label>
          <select 
            {...register('district_id')}
            className="w-full p-3 border rounded-lg border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          >
            <option value="">Selecione um distrito...</option>
            {districts.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {errors.district_id && <p className="text-red-500 text-sm mt-1">{errors.district_id.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Anos de Experiência</label>
          <input 
            type="number" 
            {...register('years_experience')}
            min="0"
            className="w-full p-3 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
            placeholder="Ex: 5" 
          />
          {errors.years_experience && <p className="text-red-500 text-sm mt-1">{errors.years_experience.message}</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button 
          type="submit" 
          disabled={isPending}
          className={`bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-md transition-colors ${isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isPending ? 'A guardar...' : 'Guardar Alterações'}
        </button>
      </div>
    </form>
  )
}
