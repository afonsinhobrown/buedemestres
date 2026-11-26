'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  checkDirectJobStatus,
  cancelJobByClient,
  getJobTrackingDetails,
  respondToProposal,
  type RefundDestination,
  type JobTrackingDetails,
} from './actions'
import Link from 'next/link'

const TrackingMapDynamic = dynamic(() => import('@/components/TrackingMap'), {
  ssr: false,
  loading: () => <div className="tracking-map-loading">A carregar mapa em tempo real…</div>,
})

const PENDING = ['pending', 'requested', 'open', 'in_negotiation']
const IN_PROGRESS = [
  'accepted',
  'scheduled',
  'price_proposed',
  'puxado',
  'price_agreed',
  'en_route',
  'arrived',
  'in_service',
  'in_progress',
  'awaiting_confirmation',
]
const FINISHED = ['completed', 'cancelled', 'expired', 'disputed']

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: 'Por pagar',
  held: 'Valor retido',
  released: 'Pagamento libertado',
  refunded: 'Estornado',
  partially_refunded: 'Parcialmente estornado',
  disputed: 'Em disputa',
}

function phaseOf(status: string): 'pending' | 'in_progress' | 'finished' {
  if (PENDING.includes(status)) return 'pending'
  if (IN_PROGRESS.includes(status)) return 'in_progress'
  return 'finished'
}

function messageFor(status: string) {
  switch (status) {
    case 'awaiting_confirmation':
      return 'O mestre terminou o serviço. Falta confirmar a conclusão para libertar o pagamento.'
    case 'en_route':
      return 'O mestre está a caminho do local combinado.'
    case 'arrived':
      return 'O mestre chegou ao local e vai iniciar o serviço.'
    case 'price_proposed':
      return 'Recebeste um orçamento do mestre. Concordas ou não com o valor?'
    case 'price_agreed':
      return 'Aceitaste o orçamento do mestre. O pagamento será tratado a seguir.'
    case 'completed':
      return 'Serviço concluído e pagamento libertado ao mestre.'
    default:
      return 'O mestre confirmou o pedido e entrará em contacto contigo em breve.'
  }
}

function money(value: string | number | null | undefined): string | null {
  if (value == null) return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return `${new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 }).format(amount)} MT`
}

const CANCELABLE = ['price_agreed', 'en_route', 'arrived']

export default function JobTracker({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<string>('pending')
  const [details, setDetails] = useState<JobTrackingDetails | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [proposalError, setProposalError] = useState<string | null>(null)

  const handleCancel = async (destination: RefundDestination) => {
    setCancelling(true)
    setCancelError(null)
    const res = await cancelJobByClient(jobId, destination)
    setCancelling(false)
    if (res.ok) {
      setStatus('cancelled')
      setDetails((current) => current ? { ...current, status: 'cancelled', payment_status: 'refunded' } : current)
    } else {
      setCancelError(res.error ?? 'Não foi possível cancelar o pedido.')
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setPaymentError(null)
    try {
      const response = await fetch('/api/payments/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: details?.id ?? jobId }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        setPaymentError(result.error ?? 'Não foi possível libertar o pagamento.')
        return
      }
      setStatus('completed')
      setDetails((current) => current ? { ...current, status: 'completed', payment_status: 'released' } : current)
    } catch {
      setPaymentError('Serviço de pagamentos indisponível. Tenta novamente.')
    } finally {
      setConfirming(false)
    }
  }

  const handleProposal = async (decision: 'accept' | 'reject') => {
    setResponding(true)
    setProposalError(null)
    const result = await respondToProposal(jobId, decision)
    setResponding(false)
    if (!result.ok) {
      setProposalError(result.error ?? 'Não foi possível responder.')
      return
    }
    if (decision === 'accept') {
      setStatus('price_agreed')
      setDetails((current) => current ? {
        ...current,
        status: 'price_agreed',
        agreed_amount: current.proposal_amount,
        proposal_status: 'accepted',
      } : current)
    } else {
      setStatus('cancelled')
      setDetails((current) => current ? { ...current, status: 'cancelled', proposal_status: 'rejected' } : current)
    }
  }

  useEffect(() => {
    let cancelled = false
    const loadDetails = async () => {
      const data = await getJobTrackingDetails(jobId)
      if (cancelled || !data) return
      setDetails(data)
      setStatus(data.status)
    }
    loadDetails()
    return () => { cancelled = true }
  }, [jobId])

  useEffect(() => {
    if (FINISHED.includes(status)) return

    let cancelled = false
    const tick = async () => {
      const data = await getJobTrackingDetails(jobId)
      if (cancelled) return
      if (data) {
        setDetails(data)
        if (data.status) setStatus(data.status)
        return
      }
      const currentStatus = await checkDirectJobStatus(jobId)
      if (!cancelled && currentStatus) setStatus(currentStatus)
    }

    tick()
    const interval = setInterval(tick, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId, status])

  const phase = phaseOf(status)
  const amount = money(details?.agreed_amount ?? details?.payment_amount)

  return (
    <div className="tracking-shell">
      {details && (
        <div className="tracking-summary">
          <div>
            <span>Mestre</span>
            <strong>{details.provider_name}</strong>
            {details.provider_slug && (
              <Link href={`/mestre/${details.provider_slug}`}>Ver perfil do mestre</Link>
            )}
          </div>
          <div>
            <span>Serviço</span>
            <strong>{details.category_name || 'Serviço sob consulta'}</strong>
          </div>
          <div>
            <span>Valor</span>
            <strong>{amount || 'Por combinar'}</strong>
          </div>
          <div>
            <span>Pagamento</span>
            <strong>{details.payment_status ? PAYMENT_LABELS[details.payment_status] || details.payment_status : 'Sem registo'}</strong>
          </div>
          <div>
            <span>Local</span>
            <strong>{[details.address, details.district_name].filter(Boolean).join(' · ') || 'Por confirmar'}</strong>
          </div>
        </div>
      )}

      {details?.lat != null && details?.lng != null && (
        <div className="tracking-map-panel">
          <TrackingMapDynamic jobId={details.id} initialLat={details.lat} initialLng={details.lng} />
        </div>
      )}

      {phase === 'pending' && (
        <div className="tracking-state">
          <div className="tracking-icon tracking-icon--blue">
            <svg style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
          <h2>A contactar o Mestre...</h2>
          <p>
            O seu pedido tocou no telemóvel do Mestre.<br />
            Aguarde que ele aceite o serviço.
          </p>
        </div>
      )}

      {phase === 'in_progress' && (
        <div className="tracking-state">
          <div className="tracking-icon tracking-icon--green">
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 className="tracking-title--green">
            {status === 'awaiting_confirmation' ? 'Serviço terminado!' : 'Pedido Aceite!'}
          </h2>
          <p>{messageFor(status)}</p>

          {details?.proposal_id && details.proposal_status === 'pending' && (status === 'price_proposed' || status === 'puxado') && (
            <div className="tracking-proposal">
              <span>Proposta do mestre</span>
              <strong>{money(details.proposal_amount) || 'Por combinar'}</strong>
              {details.proposal_description && <p>{details.proposal_description}</p>}
              {proposalError && <p className="tracking-error">{proposalError}</p>}
              <div className="tracking-cancel-actions">
                <button type="button" className="btn b1" disabled={responding} onClick={() => handleProposal('accept')}>
                  {responding ? 'A responder…' : 'Concordo com o preço'}
                </button>
                <button type="button" className="btn b2" disabled={responding} onClick={() => handleProposal('reject')}>
                  Não concordo
                </button>
              </div>
            </div>
          )}

          {details?.payment_status === 'pending_payment' && (
            <p className="tracking-note">O pagamento ainda não foi iniciado. Confirma o serviço na app do mestre quando combinarem o valor.</p>
          )}

          {status === 'awaiting_confirmation' && details?.payment_status === 'held' && (
            <div className="tracking-confirm">
              {paymentError && <p className="tracking-error">{paymentError}</p>}
              <button type="button" className="btn b1" disabled={confirming} onClick={handleConfirm}>
                {confirming ? 'A libertar pagamento…' : 'Confirmar conclusão e pagar o mestre'}
              </button>
            </div>
          )}

          {CANCELABLE.includes(status) && (
            <div className="tracking-cancel">
              <p>Tens urgência ou precisas de outro mestre? Podes cancelar e o valor retido é estornado.</p>
              {cancelError && <p className="tracking-error">{cancelError}</p>}
              <div className="tracking-cancel-actions">
                <button type="button" className="btn b2" disabled={cancelling} onClick={() => handleCancel('wallet')}>
                  {cancelling ? 'A cancelar…' : 'Cancelar → estornar à minha carteira'}
                </button>
                <button type="button" className="btn b2" disabled={cancelling} onClick={() => handleCancel('paysuite')}>
                  Cancelar → devolver por M-Pesa/eMola
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'finished' && status === 'completed' && (
        <div className="tracking-state">
          <div className="tracking-icon tracking-icon--green">
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 className="tracking-title--green">Serviço concluído</h2>
          <p>{messageFor(status)}</p>
          <Link href="/trabalhos" className="btn b1 s">Ver os meus trabalhos</Link>
        </div>
      )}

      {phase === 'finished' && status !== 'completed' && (
        <div className="tracking-state">
          <div className="tracking-icon tracking-icon--red">
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          <h2 className="tracking-title--red">
            {status === 'disputed' ? 'Disputa em análise' : 'Pedido não concluído'}
          </h2>
          <p>
            {status === 'disputed'
              ? 'O pagamento continua retido enquanto a equipa de apoio analisa o caso.'
              : 'Este pedido foi cancelado ou expirou. Pode tentar contactar outro mestre na plataforma.'}
          </p>
        </div>
      )}

      <div className="tracking-footer">
        <Link href="/">Voltar à página inicial</Link>
        <Link href="/trabalhos">Os meus trabalhos</Link>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
