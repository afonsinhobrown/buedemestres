'use client'

import React, { useState, useEffect } from 'react'
import { createEmergencyRequest, checkRequestStatus } from './actions'

export default function ClientCaller() {
  const [step, setStep] = useState(1) // 1 = Form, 2 = Searching, 3 = Found
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  
  useEffect(() => {
    if (!requestId || step !== 2) return

    const interval = setInterval(async () => {
      const status = await checkRequestStatus(requestId)
      console.log('Status atual:', status)
      
      if (status === 'accepted' || status === 'in_progress') {
        setStep(3)
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [requestId, step])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!category || !description) {
      alert('Preencha os campos obrigatórios')
      return
    }

    try {
      const id = await createEmergencyRequest(parseInt(category), description)
      setRequestId(id)
      setStep(2)
    } catch (error) {
      console.error(error)
      alert('Falha ao criar o pedido.')
    }
  }

  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      {step === 1 && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Chamar um Mestre</h2>
            <p style={{ margin: 0, color: '#666' }}>
              Diga-nos o que precisa. Os mestres da sua zona serão alertados imediatamente.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Que tipo de profissional precisa?</label>
            <select 
              style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
              value={category} 
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="4">Canalizador</option>
              <option value="5">Electricista</option>
              <option value="8">Explicador</option>
              <option value="11">Limpezas</option>
              <option value="15">Designer</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>O que está a acontecer?</label>
            <textarea 
              style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
              placeholder="Ex: O cano da cozinha rebentou e está a deitar água..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            style={{ padding: '16px', backgroundColor: '#e53e3e', color: 'white', fontWeight: 'bold', fontSize: '18px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            CHAMAR MESTRE AGORA
          </button>
        </form>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>A contactar Mestres...</h2>
          <p style={{ color: '#666', marginTop: '16px', lineHeight: '1.5' }}>
            O seu pedido está a fazer os telemóveis dos Mestres apitarem neste preciso momento.<br/>
            Aguarde. O ecrã vai atualizar assim que alguém aceitar.
          </p>
          <button 
            onClick={() => setStep(1)}
            style={{ marginTop: '24px', padding: '10px 20px', backgroundColor: '#f3f4f6', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancelar pedido
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#047857' }}>Mestre Encontrado!</h2>
          <p style={{ color: '#666', marginTop: '16px', fontSize: '18px' }}>
            Um profissional acabou de aceitar o seu pedido no Aplicativo Pro.<br/>
            Ele já está a caminho!
          </p>
          <button 
            onClick={() => setStep(1)}
            style={{ marginTop: '24px', padding: '10px 20px', backgroundColor: '#f3f4f6', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            Fazer novo pedido
          </button>
        </div>
      )}
    </div>
  )
}
